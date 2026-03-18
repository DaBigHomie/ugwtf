/**
 * JSON Reporter
 *
 * Writes SwarmResult to a timestamped JSON file in .ugwtf/reports/.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SwarmResult } from '../types.js';

const REPORTS_DIR = join(process.cwd(), '.ugwtf', 'reports');

export async function writeJsonReport(result: SwarmResult, command: string): Promise<string> {
  mkdirSync(REPORTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${command}-${timestamp}.json`;
  const filepath = join(REPORTS_DIR, filename);

  const report = {
    command,
    timestamp: new Date().toISOString(),
    mode: result.mode,
    duration: result.summary.duration,
    summary: result.summary,
    results: result.results.map(repo => ({
      repo: repo.repo,
      clusters: repo.clusterResults.map(c => ({
        clusterId: c.clusterId,
        status: c.status,
        duration: c.duration,
        agents: c.agentResults.map(a => ({
          agentId: a.agentId,
          status: a.status,
          duration: a.duration,
          message: a.message,
          ...(a.error ? { error: a.error } : {}),
          ...(a.artifacts.length > 0 ? { artifacts: a.artifacts } : {}),
          ...(a.findings?.length ? { findings: a.findings } : {}),
        })),
      })),
    })),
  };

  writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8');
  return filepath;
}
