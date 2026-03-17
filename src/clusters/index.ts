/**
 * UGWTF Agent Clusters
 *
 * 30 clusters of agents, each responsible for a domain.
 * Agents execute real logic — they write files, call GitHub APIs, and validate state.
 *
 * Cluster dependency graph (core pipeline):
 *   labels → workflows → quality → issues → prs → audit
 *   labels → prompts → chain
 *
 * Independent clusters (no deps):
 *   fsd, testing, database, security, devops, analytics, docs, commerce,
 *   design, context, performance, seo, a11y, sovereign, email, content,
 *   routing, state, auth, integration, monitoring, animation, migration
 */
import type { Agent, Cluster } from '../types.js';

// --- Core pipeline agents ---
import { labelAgents } from '../agents/label-agents.js';
import { workflowAgents } from '../agents/workflow-agents.js';
import { qualityAgents } from '../agents/quality-agents.js';
import { issueAgents } from '../agents/issue-agents.js';
import { prAgents } from '../agents/pr-agents.js';
import { auditAgents } from '../agents/audit-agents.js';
import { promptAgents } from '../agents/prompt-agents.js';
import { chainAgents } from '../agents/chain-agents.js';
import { visualAuditCluster } from '@dabighomie/audit-orchestrator/cluster';

// --- 21 new domain clusters ---
import { fsdAgents } from '../agents/fsd-agents.js';
import { testingAgents } from '../agents/testing-agents.js';
import { databaseAgents } from '../agents/database-agents.js';
import { securityAgents } from '../agents/security-agents.js';
import { devopsAgents } from '../agents/devops-agents.js';
import { analyticsAgents } from '../agents/analytics-agents.js';
import { docsAgents } from '../agents/docs-agents.js';
import { commerceAgents } from '../agents/commerce-agents.js';
import { designAgents } from '../agents/design-agents.js';
import { contextAgents } from '../agents/context-agents.js';
import { performanceAgents } from '../agents/performance-agents.js';
import { seoAgents } from '../agents/seo-agents.js';
import { a11yAgents } from '../agents/a11y-agents.js';
import { sovereignAgents } from '../agents/sovereign-agents.js';
import { emailAgents } from '../agents/email-agents.js';
import { contentAgents } from '../agents/content-agents.js';
import { routingAgents } from '../agents/routing-agents.js';
import { stateAgents } from '../agents/state-agents.js';
import { authAgents } from '../agents/auth-agents.js';
import { integrationAgents } from '../agents/integration-agents.js';
import { monitoringAgents } from '../agents/monitoring-agents.js';
import { animationAgents } from '../agents/animation-agents.js';
import { migrationAgents } from '../agents/migration-agents.js';

export const CLUSTERS: Cluster[] = [
  // ── Core pipeline (9 clusters, dependencies between each other) ────────
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
    id: 'chain',
    name: 'Prompt Chain Management',
    description: 'Load, validate, create issues, and advance the prompt execution chain',
    agents: chainAgents,
    dependsOn: ['prompts'],
  },
  {
    ...visualAuditCluster,
    agents: visualAuditCluster.agents as unknown as Agent[],
  },

  // ── Architecture & Code Quality (3 clusters) ──────────────────────────
  {
    id: 'fsd',
    name: 'FSD Architecture',
    description: 'Validate Feature-Sliced Design layers and import direction',
    agents: fsdAgents,
    dependsOn: [],
  },
  {
    id: 'design',
    name: 'Design System',
    description: 'Detect hardcoded colors, validate component library usage',
    agents: designAgents,
    dependsOn: [],
  },
  {
    id: 'state',
    name: 'State Management',
    description: 'Detect state patterns, identify prop drilling anti-patterns',
    agents: stateAgents,
    dependsOn: [],
  },

  // ── Testing & Quality (2 clusters) ─────────────────────────────────────
  {
    id: 'testing',
    name: 'Testing & QA',
    description: 'Verify test presence, run test suites, track coverage',
    agents: testingAgents,
    dependsOn: ['quality'],
  },
  {
    id: 'monitoring',
    name: 'Monitoring & Observability',
    description: 'Validate error tracking, detect stray console.log statements',
    agents: monitoringAgents,
    dependsOn: [],
  },

  // ── Data Layer (3 clusters) ────────────────────────────────────────────
  {
    id: 'database',
    name: 'Database Integrity',
    description: 'Audit migrations for destructive ops, check type freshness',
    agents: databaseAgents,
    dependsOn: [],
  },
  {
    id: 'migration',
    name: 'Migration Management',
    description: 'Validate migration ordering, naming conventions, and file sizes',
    agents: migrationAgents,
    dependsOn: ['database'],
  },
  {
    id: 'auth',
    name: 'Authentication & Authorization',
    description: 'Validate auth config, RLS policies, protected routes',
    agents: authAgents,
    dependsOn: ['database'],
  },

  // ── Security & DevOps (2 clusters) ─────────────────────────────────────
  {
    id: 'security',
    name: 'Security Scanning',
    description: 'Dependency vulnerability scanning, secret leak detection',
    agents: securityAgents,
    dependsOn: [],
  },
  {
    id: 'devops',
    name: 'DevOps & CI/CD',
    description: 'Workflow syntax validation, build config verification',
    agents: devopsAgents,
    dependsOn: ['workflows'],
  },

  // ── Performance & SEO (2 clusters) ─────────────────────────────────────
  {
    id: 'performance',
    name: 'Performance Optimization',
    description: 'Track bundle sizes, detect heavy dependencies',
    agents: performanceAgents,
    dependsOn: [],
  },
  {
    id: 'seo',
    name: 'SEO Optimization',
    description: 'Validate meta tags, sitemaps, and robots.txt',
    agents: seoAgents,
    dependsOn: [],
  },

  // ── Accessibility & Animation (2 clusters) ─────────────────────────────
  {
    id: 'a11y',
    name: 'Accessibility',
    description: 'Check alt text, aria-labels, keyboard navigation',
    agents: a11yAgents,
    dependsOn: [],
  },
  {
    id: 'animation',
    name: 'Animation & Motion',
    description: 'Validate reduced motion support, animation constants',
    agents: animationAgents,
    dependsOn: [],
  },

  // ── Business Logic (2 clusters) ────────────────────────────────────────
  {
    id: 'commerce',
    name: 'E-Commerce Validation',
    description: 'Validate cart/checkout features, payment config security',
    agents: commerceAgents,
    dependsOn: [],
  },
  {
    id: 'email',
    name: 'Email Automation',
    description: 'Check email integration, templates directory',
    agents: emailAgents,
    dependsOn: [],
  },

  // ── Documentation & Context (2 clusters) ───────────────────────────────
  {
    id: 'docs',
    name: 'Documentation Coverage',
    description: 'README completeness, essential docs presence',
    agents: docsAgents,
    dependsOn: [],
  },
  {
    id: 'context',
    name: 'Agent Context Files',
    description: 'Instruction file coverage, handoff doc validation',
    agents: contextAgents,
    dependsOn: [],
  },

  // ── Navigation & Content (2 clusters) ──────────────────────────────────
  {
    id: 'routing',
    name: 'Routing & Navigation',
    description: 'Route coverage scanning, dead link detection',
    agents: routingAgents,
    dependsOn: [],
  },
  {
    id: 'content',
    name: 'Content & Assets',
    description: 'Image optimization, static asset inventory',
    agents: contentAgents,
    dependsOn: [],
  },

  // ── Integration & Analytics (2 clusters) ───────────────────────────────
  {
    id: 'integration',
    name: 'API Integrations',
    description: 'Catalog external APIs, validate webhook config',
    agents: integrationAgents,
    dependsOn: [],
  },
  {
    id: 'analytics',
    name: 'Analytics & Health',
    description: 'Composite repo health score, dependency staleness',
    agents: analyticsAgents,
    dependsOn: ['quality', 'docs', 'context'],
  },

  // ── Governance (1 cluster) ─────────────────────────────────────────────
  {
    id: 'sovereign',
    name: 'Sovereign Governance',
    description: 'Plan compliance checking, cross-repo consistency',
    agents: sovereignAgents,
    dependsOn: [],
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
