/**
 * UGWTF Plugin — registers the visual-audit cluster with the UGWTF framework.
 *
 * This is the plugin entry-point consumed via:
 *   import { plugin } from '@dabighomie/audit-orchestrator/plugin';
 *
 * Or discovered automatically by the UGWTF plugin loader when the package
 * declares `"ugwtf-plugin": true` in its package.json.
 */
import type { UGWTFPlugin, PluginRegistry } from './ugwtf-types.js';
import { visualAuditCluster } from './cluster.js';

export const plugin: UGWTFPlugin = {
  name: 'visual-audit',
  version: '1.1.0',
  register(registry: PluginRegistry): void {
    registry.addCluster(visualAuditCluster);
  },
};
