/**
 * Reporter: Terminal — colored console output with severity icons.
 */

import type { AuditResult, PromptCluster, ReporterOptions } from '../types.js';

function printParallelMap(clusters: PromptCluster[]): void {
  if (clusters.length === 0) return;

  const line = '═'.repeat(64);
  console.log(`\n╔${line}╗`);
  console.log(`║${'PARALLEL EXECUTION MAP'.padStart(43).padEnd(64)}║`);
  console.log(`╠${line}╣`);

  const totalPrompts = clusters.reduce((s, c) => s + c.prompts.length, 0);
  const totalAgents = clusters.reduce((s, c) => s + c.agentCount, 0);
  const totalMinutes = clusters.reduce((s, c) => s + c.estimatedMinutes, 0);

  for (const c of clusters) {
    console.log(`║${''.padEnd(64)}║`);
    const mode = c.canParallelize ? '⚡ PARALLEL' : '🔗 SEQUENTIAL';
    const agents = `${c.agentCount} agents`;
    const prompts = c.prompts.join(', ');
    console.log(`║  [${c.id}] ${c.name.padEnd(28)} ${mode.padEnd(14)} ${agents.padEnd(10)}║`);
    console.log(`║       Issues: ${prompts.padEnd(48)}║`);
  }

  console.log(`║${''.padEnd(64)}║`);
  const summary = `Total: ${clusters.length} clusters · ${totalPrompts} issues · ${totalAgents} agents · ~${Math.ceil(totalMinutes / 60)}h`;
  console.log(`║  ${summary.padEnd(62)}║`);
  console.log(`╚${line}╝`);
}

export function reportTerminal(options: ReporterOptions): void {
  const { result, verbose } = options;

  console.log('\n' + '═'.repeat(64));
  console.log('  SITE AUDIT — ISSUE TRACKER');
  console.log('  Generated: ' + result.timestamp.split('T')[0]);
  console.log('  Framework: ' + result.framework);
  console.log('═'.repeat(64));

  console.log(`\n📊 Overall Completion: ${result.overallCompletion}%`);
  console.log(`   Total Issues: ${result.totalIssues}`);
  console.log(
    `   Critical: ${result.bySeverity['critical'] ?? 0} | High: ${result.bySeverity['high'] ?? 0} | Medium: ${result.bySeverity['medium'] ?? 0} | Low: ${result.bySeverity['low'] ?? 0}`
  );

  console.log('\n📋 Issues by Category:');
  for (const [cat, count] of Object.entries(result.byCategory)) {
    const bar = '█'.repeat(count) + '░'.repeat(Math.max(0, 10 - count));
    console.log(`   ${cat.padEnd(16)} ${bar} ${count}`);
  }

  console.log('\n📝 Issue Details:');
  console.log('─'.repeat(64));

  const severityOrder = ['critical', 'high', 'medium', 'low'];
  const sorted = [...result.issues].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  );

  for (const issue of sorted) {
    const icon =
      issue.severity === 'critical' ? '🔴'
      : issue.severity === 'high' ? '🟠'
      : issue.severity === 'medium' ? '🟡'
      : '🟢';
    const pctBar =
      '▓'.repeat(Math.round(issue.completionPct / 10)) +
      '░'.repeat(10 - Math.round(issue.completionPct / 10));
    console.log(`  ${icon} [${issue.id}] ${issue.title}`);
    const promptRef = issue.promptId ? `→ Prompt: ${issue.promptId}` : '';    console.log(`     ${issue.severity.toUpperCase().padEnd(10)} ${pctBar} ${issue.completionPct}%  ${promptRef}`);
    if (verbose) {
      console.log(`     ${issue.description}`);
      console.log(`     Files: ${issue.affectedFiles.join(', ')}`);
    }
  }

  console.log('\n' + '─'.repeat(64));
  console.log('🔧 Cluster Execution Plan:');
  console.log('─'.repeat(64));

  for (const cluster of result.clusters) {
    const deps =
      cluster.dependsOn.length > 0
        ? `depends: ${cluster.dependsOn.join(', ')}`
        : 'no dependencies';
    const mode = cluster.canParallelize ? '⚡ parallel' : '🔗 sequential';
    console.log(`  [${cluster.id}] ${cluster.name}`);
    console.log(
      `     ${mode} · ${cluster.agentCount} agents · ${cluster.estimatedMinutes}min · ${deps}`
    );
    console.log(`     Issues: ${cluster.prompts.join(' → ')}`);
  }

  printParallelMap(result.clusters);
}
