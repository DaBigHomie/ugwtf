/**
 * FSD Architecture Enforcement Agents
 *
 * Validates FSD layer structure, import direction, and component placement
 * across all repos.
 */
import type { Agent, AgentResult, AgentContext } from '../types.js';
import { getRepo } from '../config/repo-registry.js';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

// ---------------------------------------------------------------------------
// Agent: FSD Layer Scanner
// ---------------------------------------------------------------------------

const fsdLayerScanner: Agent = {
  id: 'fsd-layer-scanner',
  name: 'FSD Layer Scanner',
  description: 'Detect FSD layers (features, entities, shared, lib) and report structure',
  clusterId: 'fsd',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    const repoConfig = getRepo(ctx.repoAlias);
    if (!repoConfig) {
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: 0, message: 'No config', artifacts: [] };
    }

    ctx.logger.group(`FSD Layer Scan: ${ctx.repoAlias}`);

    const srcDir = join(ctx.localPath, 'src');
    const layers = ['features', 'entities', 'shared', 'lib', 'widgets', 'app'];
    const found: string[] = [];

    for (const layer of layers) {
      try {
        await readdir(join(srcDir, layer));
        found.push(layer);
      } catch {
        // Layer doesn't exist
      }
    }

    // Check for anti-pattern: flat components/ dir
    let hasFlatComponents = false;
    try {
      await readdir(join(srcDir, 'components'));
      hasFlatComponents = true;
    } catch {
      // Good — no flat components
    }

    ctx.logger.info(`FSD layers found: ${found.join(', ') || 'none'}`);
    if (hasFlatComponents) {
      ctx.logger.warn('⚠ Flat components/ directory detected — should migrate to FSD layers');
    }

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Layers: ${found.length} | Flat components: ${hasFlatComponents}`,
      artifacts: found.map(l => `layer:${l}`),
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: FSD Import Direction Validator
// ---------------------------------------------------------------------------

const fsdImportValidator: Agent = {
  id: 'fsd-import-validator',
  name: 'FSD Import Validator',
  description: 'Verify one-way import direction: app→widgets→features→entities→shared',
  clusterId: 'fsd',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`FSD Import Validation: ${ctx.repoAlias}`);

    // FSD layer hierarchy (higher index = higher layer)
    const layerOrder: Record<string, number> = {
      shared: 0, lib: 0, entities: 1, features: 2, widgets: 3, app: 4,
    };

    const violations: string[] = [];
    const srcDir = join(ctx.localPath, 'src');

    // Scan each layer for upward imports
    for (const [layer, level] of Object.entries(layerOrder)) {
      if (level === 0) continue; // shared/lib can't violate

      const layerDir = join(srcDir, layer);
      try {
        await readdir(layerDir);
      } catch {
        continue; // Layer doesn't exist
      }

      // Sample check: read a few .ts/.tsx files and look for imports from higher layers
      try {
        const files = await collectTsFiles(layerDir, 3);
        for (const file of files) {
          const content = await readFile(file, 'utf-8');
          const imports = [...content.matchAll(/from\s+['"](@\/|\.\.\/)*(\w+)\//g)];

          for (const imp of imports) {
            const importedLayer = imp[2]!;
            const importedLevel = layerOrder[importedLayer];
            if (importedLevel !== undefined && importedLevel > level) {
              violations.push(`${relative(srcDir, file)}: imports from ${importedLayer}/ (layer ${importedLevel} > ${level})`);
            }
          }
        }
      } catch {
        // Skip unreadable directories
      }
    }

    if (violations.length > 0) {
      ctx.logger.warn(`Found ${violations.length} FSD import violations`);
      for (const v of violations.slice(0, 5)) {
        ctx.logger.warn(`  ✗ ${v}`);
      }
    } else {
      ctx.logger.success('No FSD import violations detected');
    }

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: violations.length > 0 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Violations: ${violations.length}`,
      artifacts: violations,
    };
  },
};

/** Collect up to `maxDepth` levels of .ts/.tsx files from a directory */
async function collectTsFiles(dir: string, maxDepth: number, depth = 0): Promise<string[]> {
  if (depth >= maxDepth) return [];
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        results.push(full);
      } else if (entry.isDirectory() && entry.name !== 'node_modules') {
        results.push(...await collectTsFiles(full, maxDepth, depth + 1));
      }
    }
  } catch {
    // Skip
  }
  return results;
}

export const fsdAgents: Agent[] = [fsdLayerScanner, fsdImportValidator];
