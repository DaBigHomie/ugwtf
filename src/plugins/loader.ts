/**
 * Plugin Loader
 *
 * Discovers and loads UGWTF plugins from `node_modules/@ugwtf/*`.
 * Each plugin must have `"ugwtf-plugin": true` (or an object) in its
 * `package.json` and export a default conforming to {@link UGWTFPlugin}.
 *
 * @example
 * // In a plugin's package.json:
 * {
 *   "name": "@ugwtf/my-plugin",
 *   "ugwtf-plugin": { "entry": "dist/index.js" }
 * }
 *
 * // In the plugin's main entry:
 * import type { UGWTFPlugin, PluginRegistry } from '@dabighomie/ugwtf';
 * const plugin: UGWTFPlugin = {
 *   name: 'my-plugin',
 *   version: '1.0.0',
 *   register(registry: PluginRegistry) {
 *     registry.addCluster({ ... });
 *   },
 * };
 * export default plugin;
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { UGWTFPlugin, PluginRegistry, Cluster, Agent } from '../types.js';

/**
 * Internal registry that collects clusters, agents, and commands from plugins.
 * Used by the orchestrator to merge plugin contributions into the runtime.
 */
export class InternalPluginRegistry implements PluginRegistry {
  readonly clusters: Cluster[] = [];
  readonly agents: Map<string, Agent[]> = new Map();
  readonly commands: Map<string, string[]> = new Map();

  addCluster(cluster: Cluster): void {
    this.clusters.push(cluster);
  }

  addAgent(clusterId: string, agent: Agent): void {
    const existing = this.agents.get(clusterId) ?? [];
    existing.push(agent);
    this.agents.set(clusterId, existing);
  }

  addCommand(name: string, clusterIds: string[]): void {
    this.commands.set(name, clusterIds);
  }
}

export interface PluginLoadResult {
  plugins: UGWTFPlugin[];
  registry: InternalPluginRegistry;
}

/**
 * Scan `node_modules/@ugwtf/` for plugin packages and load them.
 *
 * @param nodeModulesPath - Override for the `@ugwtf` directory (for testing).
 * @returns Loaded plugins and their accumulated registry.
 */
export async function loadPlugins(nodeModulesPath?: string): Promise<PluginLoadResult> {
  const basePath = nodeModulesPath ?? join(process.cwd(), 'node_modules', '@ugwtf');
  const registry = new InternalPluginRegistry();

  if (!existsSync(basePath)) {
    return { plugins: [], registry };
  }

  const dirs = readdirSync(basePath, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const plugins: UGWTFPlugin[] = [];

  for (const dir of dirs) {
    const pkgPath = join(basePath, dir, 'package.json');
    if (!existsSync(pkgPath)) continue;

    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
      if (!pkg['ugwtf-plugin']) continue;

      // Resolve entry point
      const pluginMeta = pkg['ugwtf-plugin'];
      const entry = (typeof pluginMeta === 'object' && pluginMeta !== null && 'entry' in pluginMeta)
        ? String((pluginMeta as Record<string, unknown>).entry)
        : (typeof pkg.main === 'string' ? pkg.main : 'index.js');

      const fullEntry = join(basePath, dir, entry);
      const mod = await import(fullEntry) as Record<string, unknown>;
      const plugin = (mod.default ?? mod) as UGWTFPlugin;

      if (plugin.name && plugin.version && typeof plugin.register === 'function') {
        plugin.register(registry);
        plugins.push(plugin);
      }
    } catch {
      // Skip plugins that fail to load — don't crash the CLI
    }
  }

  return { plugins, registry };
}
