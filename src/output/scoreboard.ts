/**
 * SCOREBOARD Generator
 *
 * Generates SCOREBOARD.json from audit results with trend tracking
 * and emits Markdown summaries for PR comments.
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SwarmResult, AgentStatus } from '../types.js';

const UGWTF_DIR = join(process.cwd(), '.ugwtf');
const SCOREBOARD_PATH = join(UGWTF_DIR, 'SCOREBOARD.json');
const SCOREBOARD_MD_PATH = join(UGWTF_DIR, 'SCOREBOARD.md');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RepoScore {
  repo: string;
  score: number;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
}

export interface Scoreboard {
  generatedAt: string;
  overallScore: number;
  repos: RepoScore[];
  previousScore?: number;
  trend?: 'up' | 'down' | 'stable';
}

// ---------------------------------------------------------------------------
// G36: Auto-generate SCOREBOARD.json from audit results
// ---------------------------------------------------------------------------

function computeRepoScore(status: AgentStatus[], total: number): number {
  if (total === 0) return 100;
  const passed = status.filter(s => s === 'success').length;
  return Math.round((passed / total) * 100);
}

export function generateScoreboard(result: SwarmResult): Scoreboard {
  const repos: RepoScore[] = result.results.map(repo => {
    const agents: AgentStatus[] = [];
    for (const cluster of repo.clusterResults) {
      for (const agent of cluster.agentResults) {
        agents.push(agent.status);
      }
    }

    const passed = agents.filter(s => s === 'success').length;
    const failed = agents.filter(s => s === 'failed').length;
    const skipped = agents.filter(s => s === 'skipped').length;
    const total = agents.length;

    return {
      repo: repo.repo,
      score: computeRepoScore(agents, total),
      passed,
      failed,
      skipped,
      total,
    };
  });

  const overallScore = repos.length > 0
    ? Math.round(repos.reduce((sum, r) => sum + r.score, 0) / repos.length)
    : 0;

  // G37: Trend tracking — compare with previous scoreboard
  const previous = readPreviousScoreboard();
  const previousScore = previous?.overallScore;
  let trend: Scoreboard['trend'];
  if (previousScore !== undefined) {
    if (overallScore > previousScore) trend = 'up';
    else if (overallScore < previousScore) trend = 'down';
    else trend = 'stable';
  }

  return {
    generatedAt: new Date().toISOString(),
    overallScore,
    repos,
    ...(previousScore !== undefined ? { previousScore } : {}),
    ...(trend ? { trend } : {}),
  };
}

function readPreviousScoreboard(): Scoreboard | null {
  try {
    const raw = readFileSync(SCOREBOARD_PATH, 'utf-8');
    return JSON.parse(raw) as Scoreboard;
  } catch {
    return null;
  }
}

export function writeScoreboard(scoreboard: Scoreboard): string {
  mkdirSync(UGWTF_DIR, { recursive: true });
  writeFileSync(SCOREBOARD_PATH, JSON.stringify(scoreboard, null, 2), 'utf-8');
  return SCOREBOARD_PATH;
}

// ---------------------------------------------------------------------------
// G38: Emit SCOREBOARD as Markdown
// ---------------------------------------------------------------------------

export function formatScoreboardMarkdown(scoreboard: Scoreboard): string {
  const lines: string[] = [];

  const trendIcon = scoreboard.trend === 'up' ? '📈' : scoreboard.trend === 'down' ? '📉' : '➡️';
  const trendText = scoreboard.previousScore !== undefined
    ? ` (${trendIcon} prev: ${scoreboard.previousScore}%)`
    : '';

  lines.push('# UGWTF SCOREBOARD');
  lines.push('');
  lines.push(`**Generated**: ${scoreboard.generatedAt}`);
  lines.push(`**Overall Score**: ${scoreboard.overallScore}%${trendText}`);
  lines.push('');

  // Repo table
  lines.push('| Repo | Score | Passed | Failed | Skipped | Total |');
  lines.push('|------|-------|--------|--------|---------|-------|');

  for (const repo of scoreboard.repos) {
    const icon = repo.score >= 80 ? '✅' : repo.score >= 60 ? '🟡' : '🔴';
    lines.push(`| ${icon} ${repo.repo} | ${repo.score}% | ${repo.passed} | ${repo.failed} | ${repo.skipped} | ${repo.total} |`);
  }

  lines.push('');

  // Target tracking
  const aboveTarget = scoreboard.repos.filter(r => r.score >= 80).length;
  lines.push(`**Repos at target (≥80%)**: ${aboveTarget}/${scoreboard.repos.length}`);

  return lines.join('\n');
}

export function writeScoreboardMarkdown(scoreboard: Scoreboard): string {
  mkdirSync(UGWTF_DIR, { recursive: true });
  const markdown = formatScoreboardMarkdown(scoreboard);
  writeFileSync(SCOREBOARD_MD_PATH, markdown, 'utf-8');
  return SCOREBOARD_MD_PATH;
}
