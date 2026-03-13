/**
 * UGWTF Agent Clusters
 *
 * 7 clusters of agents, each responsible for a domain.
 * Agents execute real logic — they write files, call GitHub APIs, and validate state.
 *
 * Cluster dependency graph:
 *   labels → workflows → quality → issues → prs → audit
 *   labels → prompts
 */
import type { Agent, Cluster } from '../types.js';
import { labelAgents } from '../agents/label-agents.js';
import { workflowAgents } from '../agents/workflow-agents.js';
import { qualityAgents } from '../agents/quality-agents.js';
import { issueAgents } from '../agents/issue-agents.js';
import { prAgents } from '../agents/pr-agents.js';
import { auditAgents } from '../agents/audit-agents.js';
import { promptAgents } from '../agents/prompt-agents.js';
import { visualAuditCluster } from '@dabighomie/audit-orchestrator/cluster';

export const CLUSTERS: Cluster[] = [
  {
    id: 'labels',
    name: 'Label Synchronization',
    description: 'Sync universal + repo-specific labels to GitHub',
    agents: labelAgents,
    dependsOn: [],
  },
  {
    id: 'workflows',
    name: 'Workflow Deployment',
    description: 'Generate and write CI/CD workflow files to repos',
    agents: workflowAgents,
    dependsOn: ['labels'],
  },
  {
    id: 'quality',
    name: 'Quality Gate Validation',
    description: 'Validate TypeScript, ESLint, build, and config health',
    agents: qualityAgents,
    dependsOn: [],
  },
  {
    id: 'issues',
    name: 'Issue Management',
    description: 'Create, triage, and manage automation issues',
    agents: issueAgents,
    dependsOn: ['labels'],
  },
  {
    id: 'prs',
    name: 'PR Management',
    description: 'Review, approve, and manage Copilot PRs with DB firewall',
    agents: prAgents,
    dependsOn: ['labels', 'quality'],
  },
  {
    id: 'audit',
    name: 'Audit & Reporting',
    description: 'Full-stack audit with scoreboard generation',
    agents: auditAgents,
    dependsOn: ['labels', 'workflows', 'quality'],
  },
  {
    id: 'prompts',
    name: 'Prompt Intelligence',
    description: 'Scan, validate, score, and forecast .prompt.md files; create GitHub Issues',
    agents: promptAgents,
    dependsOn: ['labels'],
  },
  {
    ...visualAuditCluster,
    agents: visualAuditCluster.agents as unknown as Agent[],
  },
];

export function getCluster(id: string): Cluster | undefined {
  return CLUSTERS.find(c => c.id === id);
}

export function getClusters(ids: string[]): Cluster[] {
  if (ids.length === 0) return CLUSTERS;
  return CLUSTERS.filter(c => ids.includes(c.id));
}

/**
 * Topological sort of clusters based on dependency graph.
 * Returns execution waves — clusters in the same wave can run in parallel.
 */
export function clusterExecutionOrder(clusters: Cluster[]): Cluster[][] {
  const clusterMap = new Map(clusters.map(c => [c.id, c]));
  const resolved = new Set<string>();
  const waves: Cluster[][] = [];

  let remaining = [...clusters];

  while (remaining.length > 0) {
    const wave = remaining.filter(c =>
      c.dependsOn.every(dep => resolved.has(dep) || !clusterMap.has(dep))
    );

    if (wave.length === 0) {
      // Circular dependency — force remaining into final wave
      waves.push(remaining);
      break;
    }

    waves.push(wave);
    for (const c of wave) {
      resolved.add(c.id);
    }
    remaining = remaining.filter(c => !resolved.has(c.id));
  }

  return waves;
}
