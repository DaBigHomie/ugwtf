/**
 * Last-Run Persistence
 *
 * Writes a compact summary to .ugwtf/last-run.json after every execution.
 * Useful for quick `ugwtf status` checks and CI integration.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SwarmResult } from '../types.js';

const UGWTF_DIR = join(process.cwd(), '.ugwtf');
const LAST_RUN_PATH = join(UGWTF_DIR, 'last-run.json');

export interface LastRunData {
  command: string;
  timestamp: string;
  duration: number;
  summary: {
    totalAgents: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
  repos: string[];
  failedAgents: Array<{ agentId: string; repo: string; message: string }>;
}

/**
 * Persist a compact last-run summary to `.ugwtf/last-run.json`.
 *
 * @param result  - The completed swarm result.
 * @param command - CLI command that produced the result.
 * @returns Absolute path to the written file.
 */
export async function persistLastRun(result: SwarmResult, command: string): Promise<string> {
  mkdirSync(UGWTF_DIR, { recursive: true });

  const failedAgents: LastRunData['failedAgents'] = [];
  for (const repo of result.results) {
    for (const cluster of repo.clusterResults) {
      for (const agent of cluster.agentResults) {
        if (agent.status === 'failed') {
          failedAgents.push({
            agentId: agent.agentId,
            repo: agent.repo,
            message: agent.message,
          });
        }
      }
    }
  }

  const data: LastRunData = {
    command,
    timestamp: new Date().toISOString(),
    duration: result.summary.duration,
    summary: {
      totalAgents: result.summary.totalAgents,
      succeeded: result.summary.succeeded,
      failed: result.summary.failed,
      skipped: result.summary.skipped,
    },
    repos: result.results.map(r => r.repo),
    failedAgents,
  };

  writeFileSync(LAST_RUN_PATH, JSON.stringify(data, null, 2), 'utf-8');
  return LAST_RUN_PATH;
}

/**
 * Read the last-run summary from `.ugwtf/last-run.json`.
 *
 * @returns The parsed {@link LastRunData}, or `null` if the file does not exist.
 */
export function readLastRun(): LastRunData | null {
  try {
    const raw = readFileSync(LAST_RUN_PATH, 'utf-8');
    return JSON.parse(raw) as LastRunData;
  } catch {
    return null;
  }
}
