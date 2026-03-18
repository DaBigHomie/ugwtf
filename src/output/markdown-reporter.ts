/**
 * Markdown Reporter
 *
 * Writes SwarmResult as a human-readable Markdown report in .ugwtf/reports/.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SwarmResult } from '../types.js';
import { collectFindings, formatFindingsMarkdown } from './findings-formatter.js';

const REPORTS_DIR = join(process.cwd(), '.ugwtf', 'reports');

export async function writeMarkdownReport(result: SwarmResult, command: string): Promise<string> {
  mkdirSync(REPORTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${command}-${timestamp}.md`;
  const filepath = join(REPORTS_DIR, filename);

  const lines: string[] = [];

  lines.push(`# UGWTF Report: \`${command}\``);
  lines.push('');
  lines.push(`**Generated**: ${new Date().toISOString()}`);
  lines.push(`**Mode**: ${result.mode}`);
  lines.push(`**Duration**: ${result.summary.duration}ms`);
  lines.push('');

  // Summary table
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Agents | ${result.summary.totalAgents} |`);
  lines.push(`| Succeeded | ${result.summary.succeeded} |`);
  lines.push(`| Failed | ${result.summary.failed} |`);
  lines.push(`| Skipped | ${result.summary.skipped} |`);
  lines.push('');

  // Per-repo detail
  for (const repo of result.results) {
    lines.push(`## ${repo.repo}`);
    lines.push('');

    for (const cluster of repo.clusterResults) {
      const statusIcon = cluster.status === 'success' ? '✅' : cluster.status === 'failed' ? '❌' : '⏭️';
      lines.push(`### ${statusIcon} ${cluster.clusterId} (${cluster.duration}ms)`);
      lines.push('');

      if (cluster.agentResults.length > 0) {
        lines.push('| Agent | Status | Duration | Message |');
        lines.push('|-------|--------|----------|---------|');
        for (const agent of cluster.agentResults) {
          const icon = agent.status === 'success' ? '✅' : agent.status === 'failed' ? '❌' : '⏭️';
          const msg = agent.message.replace(/\|/g, '\\|');
          lines.push(`| ${agent.agentId} | ${icon} ${agent.status} | ${agent.duration}ms | ${msg} |`);
        }
        lines.push('');
      }

      // Show errors inline
      const failures = cluster.agentResults.filter(a => a.error);
      if (failures.length > 0) {
        lines.push('**Errors:**');
        for (const f of failures) {
          lines.push(`- \`${f.agentId}\`: ${f.error}`);
        }
        lines.push('');
      }
    }
  }

  // Append findings section
  const findings = collectFindings(result);
  if (findings.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push(formatFindingsMarkdown(findings));
    lines.push('');
  }

  writeFileSync(filepath, lines.join('\n'), 'utf-8');
  return filepath;
}
