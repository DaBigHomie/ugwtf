/**
 * UGWTF Cluster definition for visual-audit.
 *
 * Registers the visual-audit cluster with:
 *   - 10 agents (one per audit rule)
 *   - DAG dependency: runs after 'quality' cluster
 *
 * Usage from UGWTF clusters/index.ts:
 *   import { visualAuditCluster } from '@dabighomie/audit-orchestrator/cluster';
 *   CLUSTERS.push(visualAuditCluster);
 */
import { visualAuditAgents } from './agent.js';
import type { Cluster } from './ugwtf-types.js';

export const visualAuditCluster: Cluster = {
  id: 'visual-audit',
  name: 'Visual Audit & Issue Detection',
  description: 'Run 10 visual/UX audit rules: dark mode, accessibility, design system, mobile, checkout, collections, Supabase, test IDs, buttons, marquee',
  agents: visualAuditAgents,
  dependsOn: ['quality'],
};
