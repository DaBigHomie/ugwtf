/**
 * UGWTF Plugin — registers the visual-audit cluster with the UGWTF framework.
 *
 */
import type { UGWTFPlugin, PluginRegistry } from '../types.js';
import { visualAuditCluster } from './cluster.js';

export const plugin: UGWTFPlugin = {
  name: 'visual-audit',
  version: '1.1.0',
  register(registry: PluginRegistry): void {
    registry.addCluster(visualAuditCluster);
  },
};
