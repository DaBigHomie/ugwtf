/**
 * Reporter: Markdown — generates a readable MD report.
 */

import { writeFileSync } from 'node:fs';
import type { AuditResult, ReporterOptions } from '../types.js';

export function reportMarkdown(options: ReporterOptions): void {
  const { result } = options;
  const lines: string[] = [];

  lines.push(`# Audit Results`);
  lines.push('');
  lines.push(`**Generated**: ${result.timestamp}`);
  lines.push(`**Framework**: ${result.framework}`);
  lines.push(`**Directory**: \`${result.cwd}\``);
  lines.push('');
  lines.push(`## Summary`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Issues | ${result.totalIssues} |`);
  lines.push(`| Overall Completion | ${result.overallCompletion}% |`);
  lines.push(`| Critical | ${result.bySeverity['critical'] ?? 0} |`);
  lines.push(`| High | ${result.bySeverity['high'] ?? 0} |`);
  lines.push(`| Medium | ${result.bySeverity['medium'] ?? 0} |`);
  lines.push(`| Low | ${result.bySeverity['low'] ?? 0} |`);
  lines.push('');

  lines.push(`## Issues by Category`);
  lines.push('');
  for (const [cat, count] of Object.entries(result.byCategory)) {
    lines.push(`- **${cat}**: ${count}`);
  }
  lines.push('');

  lines.push(`## Issue Details`);
  lines.push('');
  lines.push(`| ID | Severity | Title | Completion | Prompt |`);
  lines.push(`|----|----------|-------|------------|--------|`);

  const severityOrder = ['critical', 'high', 'medium', 'low'];
  const sorted = [...result.issues].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  );

  for (const issue of sorted) {
    const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'high' ? '🟠' : issue.severity === 'medium' ? '🟡' : '🟢';
    lines.push(`| ${issue.id} | ${icon} ${issue.severity} | ${issue.title} | ${issue.completionPct}% | ${issue.promptId} |`);
  }
  lines.push('');

  lines.push(`## Cluster Execution Plan`);
  lines.push('');
  for (const cluster of result.clusters) {
    const deps = cluster.dependsOn.length > 0 ? `depends: ${cluster.dependsOn.join(', ')}` : 'no deps';
    const mode = cluster.canParallelize ? 'parallel' : 'sequential';
    lines.push(`### [${cluster.id}] ${cluster.name}`);
    lines.push(`- **Mode**: ${mode} · **Agents**: ${cluster.agentCount} · **Est**: ${cluster.estimatedMinutes}min · **${deps}**`);
    lines.push(`- **Prompts**: ${cluster.prompts.join(' → ')}`);
    lines.push('');
  }

  const md = lines.join('\n');

  if (options.outputPath) {
    writeFileSync(options.outputPath, md);
    if (options.verbose) console.log(`Markdown written to ${options.outputPath}`);
  } else {
    console.log(md);
  }
}
