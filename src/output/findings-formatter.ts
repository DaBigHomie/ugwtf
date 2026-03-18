/**
 * Findings Formatter
 *
 * Collects AgentFinding[] from SwarmResult and formats them
 * as a severity-sorted table for CLI output and markdown reports.
 */
import type { SwarmResult, AgentFinding } from '../types.js';

export interface AggregatedFinding {
  repo: string;
  clusterId: string;
  agentId: string;
  finding: AgentFinding;
}

/** Extract all findings from a SwarmResult into a flat, severity-sorted list. */
export function collectFindings(result: SwarmResult): AggregatedFinding[] {
  const all: AggregatedFinding[] = [];

  for (const repo of result.results) {
    for (const cluster of repo.clusterResults) {
      for (const agent of cluster.agentResults) {
        if (agent.findings) {
          for (const finding of agent.findings) {
            all.push({
              repo: repo.repo,
              clusterId: cluster.clusterId,
              agentId: agent.agentId,
              finding,
            });
          }
        }
      }
    }
  }

  // Sort: errors first, then warnings, then info
  const order = { error: 0, warning: 1, info: 2 } as const;
  all.sort((a, b) => order[a.finding.severity] - order[b.finding.severity]);

  return all;
}

/** Format findings as a plain-text table for CLI output. */
export function formatFindingsTable(findings: AggregatedFinding[]): string {
  if (findings.length === 0) return 'No findings.\n';

  const errors = findings.filter(f => f.finding.severity === 'error');
  const warnings = findings.filter(f => f.finding.severity === 'warning');
  const infos = findings.filter(f => f.finding.severity === 'info');

  const lines: string[] = [];

  lines.push(`Findings: ${errors.length} errors, ${warnings.length} warnings, ${infos.length} info`);
  lines.push('');

  // CLI-friendly table
  const SEV_ICON = { error: '✗', warning: '!', info: '·' } as const;
  const header = 'Sev  | Repo       | Agent                        | Message';
  const divider = '-----|------------|------------------------------|--------';
  lines.push(header);
  lines.push(divider);

  for (const f of findings) {
    const icon = SEV_ICON[f.finding.severity];
    const repo = f.repo.padEnd(10).slice(0, 10);
    const agent = f.agentId.padEnd(28).slice(0, 28);
    lines.push(`  ${icon}  | ${repo} | ${agent} | ${f.finding.message}`);
  }

  return lines.join('\n');
}

/** Format findings as a Markdown table for reports. */
export function formatFindingsMarkdown(findings: AggregatedFinding[]): string {
  if (findings.length === 0) return 'No findings.\n';

  const errors = findings.filter(f => f.finding.severity === 'error');
  const warnings = findings.filter(f => f.finding.severity === 'warning');
  const infos = findings.filter(f => f.finding.severity === 'info');

  const lines: string[] = [];

  lines.push('## Findings');
  lines.push('');
  lines.push(`**${errors.length}** errors, **${warnings.length}** warnings, **${infos.length}** info`);
  lines.push('');
  lines.push('| Sev | Repo | Agent | Message | File |');
  lines.push('|-----|------|-------|---------|------|');

  for (const f of findings) {
    const icon = f.finding.severity === 'error' ? '🔴' : f.finding.severity === 'warning' ? '🟡' : '🔵';
    const file = f.finding.file ?? '-';
    const msg = f.finding.message.replace(/\|/g, '\\|');
    lines.push(`| ${icon} | ${f.repo} | ${f.agentId} | ${msg} | ${file} |`);
  }

  return lines.join('\n');
}
