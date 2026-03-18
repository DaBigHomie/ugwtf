/**
 * `ugwtf list` — Display all clusters, agents, and repos.
 *
 * Usage:
 *   ugwtf list               Show everything
 *   ugwtf list clusters      Show clusters only
 *   ugwtf list agents        Show agents only
 *   ugwtf list repos         Show repos only
 */
import { CLUSTERS } from '../clusters/index.js';
import { REPOS } from '../config/repo-registry.js';
import type { Agent } from '../types.js';

type ListTarget = 'all' | 'clusters' | 'agents' | 'repos';

/** Parse sub-arguments for the list command. */
export function parseListArgs(args: string[]): ListTarget | null {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
  Usage: ugwtf list [clusters|agents|repos]

  Display registered clusters, agents, and repos.
  With no argument, shows all three sections.
`);
    return null;
  }

  const target = args[0];
  if (!target) return 'all';
  if (['clusters', 'agents', 'repos'].includes(target)) return target as ListTarget;

  console.error(`Unknown list target: ${target}`);
  console.error('Valid targets: clusters, agents, repos');
  process.exit(1);
}

/** Run the list command. */
export function listCommand(target: ListTarget): void {
  if (target === 'all' || target === 'clusters') printClusters();
  if (target === 'all' || target === 'agents') printAgents();
  if (target === 'all' || target === 'repos') printRepos();
  console.log('');
}

// ── Printers ─────────────────────────────────────────────────────────────

function printClusters(): void {
  console.log(`\n  Clusters (${CLUSTERS.length}):\n`);
  console.log(`  ${'ID'.padEnd(22)} ${'Name'.padEnd(36)} Agents`);
  console.log(`  ${'─'.repeat(70)}`);
  for (const c of CLUSTERS) {
    console.log(`  ${c.id.padEnd(22)} ${c.name.padEnd(36)} ${c.agents.length}`);
  }
}

function printAgents(): void {
  const allAgents: Agent[] = CLUSTERS.flatMap(c => c.agents);
  console.log(`\n  Agents (${allAgents.length}):\n`);
  console.log(`  ${'ID'.padEnd(32)} ${'Cluster'.padEnd(22)} Description`);
  console.log(`  ${'─'.repeat(80)}`);
  for (const a of allAgents) {
    const desc = a.description.length > 40 ? a.description.slice(0, 37) + '...' : a.description;
    console.log(`  ${a.id.padEnd(32)} ${a.clusterId.padEnd(22)} ${desc}`);
  }
}

function printRepos(): void {
  const repos = Object.values(REPOS);
  console.log(`\n  Repos (${repos.length}):\n`);
  console.log(`  ${'Alias'.padEnd(14)} ${'Slug'.padEnd(38)} ${'Framework'.padEnd(14)} Supabase`);
  console.log(`  ${'─'.repeat(80)}`);
  for (const r of repos) {
    console.log(`  ${r.alias.padEnd(14)} ${r.slug.padEnd(38)} ${r.framework.padEnd(14)} ${r.supabaseProjectId ? 'yes' : 'no'}`);
  }
}
