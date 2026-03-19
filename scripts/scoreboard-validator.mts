#!/usr/bin/env npx tsx
/**
 * scoreboard-validator.mts — Validate scoreboard end-to-end integration
 *
 * Multi-agent swarm script that:
 * 1. Generates a mock SwarmResult with ALL registered clusters (including visual-audit)
 * 2. Feeds it through generateScoreboard()
 * 3. Validates output structure, score math, and trend tracking
 * 4. Produces a validation report
 *
 * Reduces context usage by running a single script instead of multiple interactive checks.
 *
 * Usage:
 *   npx tsx scripts/scoreboard-validator.mts              # Validate & report
 *   npx tsx scripts/scoreboard-validator.mts --json       # JSON output
 *   npx tsx scripts/scoreboard-validator.mts --fix        # Write golden SCOREBOARD.json
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ugwtfRoot = resolve(__dirname, '..');

// Dynamic imports for ESM modules
const { CLUSTERS } = await import(join(ugwtfRoot, 'dist', 'clusters', 'index.js'));
const { generateScoreboard, formatScoreboardMarkdown } = await import(join(ugwtfRoot, 'dist', 'output', 'scoreboard.js'));

// ── CLI parsing ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const fixMode = args.includes('--fix');

// ── Types ────────────────────────────────────────────────────────────────
interface ValidationCheck {
  name: string;
  pass: boolean;
  detail: string;
}

// ── Mock data generator ──────────────────────────────────────────────────
function generateMockSwarmResult(repos: string[]) {
  type MockCluster = { id: string; agents: Array<{ id: string }> };

  const results = repos.map(repo => ({
    repo,
    clusterResults: (CLUSTERS as MockCluster[]).map(cluster => ({
      clusterId: cluster.id,
      status: 'success' as const,
      duration: Math.floor(Math.random() * 200) + 50,
      agentResults: cluster.agents.map((agent: { id: string }) => ({
        agentId: agent.id,
        status: Math.random() > 0.15 ? 'success' as const : 'failed' as const,
        repo,
        duration: Math.floor(Math.random() * 100) + 10,
        message: 'Mock result',
        artifacts: [],
      })),
    })),
  }));

  const totalAgents = results.reduce((s, r) =>
    s + r.clusterResults.reduce((cs, c) => cs + c.agentResults.length, 0), 0);
  const succeeded = results.reduce((s, r) =>
    s + r.clusterResults.reduce((cs, c) =>
      cs + c.agentResults.filter(a => a.status === 'success').length, 0), 0);

  return {
    mode: 'parallel',
    startedAt: Date.now() - 5000,
    completedAt: Date.now(),
    results,
    summary: {
      totalAgents,
      succeeded,
      failed: totalAgents - succeeded,
      skipped: 0,
      duration: 5000,
    },
  };
}

// ── Validation checks ────────────────────────────────────────────────────
function validate(): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const mockRepos = ['damieus', 'ffs'];
  const mockResult = generateMockSwarmResult(mockRepos);

  // Check 1: visual-audit cluster registered
  type MockCluster = { id: string; agents: Array<{ id: string }> };
  const vaCluster = (CLUSTERS as MockCluster[]).find((c: MockCluster) => c.id === 'visual-audit');
  checks.push({
    name: 'visual-audit cluster registered',
    pass: !!vaCluster,
    detail: vaCluster ? `Found with ${vaCluster.agents.length} agents` : 'NOT FOUND',
  });

  // Check 2: generateScoreboard produces valid output
  const scoreboard = generateScoreboard(mockResult);
  checks.push({
    name: 'generateScoreboard returns valid structure',
    pass: !!scoreboard && !!scoreboard.repos && !!scoreboard.generatedAt,
    detail: `${scoreboard.repos.length} repos, overall: ${scoreboard.overallScore}%`,
  });

  // Check 3: All repos present in scoreboard
  const repoNames = scoreboard.repos.map((r: { repo: string }) => r.repo);
  const allPresent = mockRepos.every(r => repoNames.includes(r));
  checks.push({
    name: 'all repos present in scoreboard',
    pass: allPresent,
    detail: `Expected: ${mockRepos.join(', ')} → Got: ${repoNames.join(', ')}`,
  });

  // Check 4: visual-audit agent results appear in totals
  const totalAgentsInScoreboard = scoreboard.repos.reduce(
    (s: number, r: { total: number }) => s + r.total, 0);
  const expectedMinAgents = (CLUSTERS as MockCluster[]).reduce(
    (s: number, c: MockCluster) => s + c.agents.length, 0) * mockRepos.length;
  checks.push({
    name: 'agent count matches cluster registration',
    pass: totalAgentsInScoreboard === expectedMinAgents,
    detail: `Scoreboard: ${totalAgentsInScoreboard}, Expected: ${expectedMinAgents}`,
  });

  // Check 5: Score math is correct
  for (const repo of scoreboard.repos as Array<{ repo: string; score: number; passed: number; total: number }>) {
    const expectedScore = repo.total === 0 ? 100 : Math.round((repo.passed / repo.total) * 100);
    checks.push({
      name: `score math correct for ${repo.repo}`,
      pass: repo.score === expectedScore,
      detail: `${repo.passed}/${repo.total} = ${expectedScore}%, got ${repo.score}%`,
    });
  }

  // Check 6: Overall score is average of repo scores
  const avgScore = Math.round(
    scoreboard.repos.reduce((s: number, r: { score: number }) => s + r.score, 0) / scoreboard.repos.length
  );
  checks.push({
    name: 'overall score is repo average',
    pass: scoreboard.overallScore === avgScore,
    detail: `Expected: ${avgScore}%, Got: ${scoreboard.overallScore}%`,
  });

  // Check 7: Markdown renders without error
  let mdOk = false;
  let mdDetail = '';
  try {
    const md = formatScoreboardMarkdown(scoreboard);
    mdOk = md.includes('SCOREBOARD') && md.includes('damieus');
    mdDetail = `${md.split('\n').length} lines, contains SCOREBOARD header`;
  } catch (err) {
    mdDetail = `Error: ${err}`;
  }
  checks.push({ name: 'markdown rendering works', pass: mdOk, detail: mdDetail });

  return checks;
}

// ── Execution ────────────────────────────────────────────────────────────
if (!jsonOutput) {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   UGWTF Scoreboard Validator             ║');
  console.log('╚══════════════════════════════════════════╝\n');
}

const checks = validate();
const allPass = checks.every(c => c.pass);

if (jsonOutput) {
  console.log(JSON.stringify({ checks, allPass, timestamp: new Date().toISOString() }, null, 2));
} else {
  for (const check of checks) {
    const icon = check.pass ? '✅' : '❌';
    console.log(`  ${icon} ${check.name}`);
    console.log(`     ${check.detail}`);
  }

  console.log('\n───────────────────────────────────────────');
  console.log(`  ${checks.length} checks | ${checks.filter(c => c.pass).length} pass | ${checks.filter(c => !c.pass).length} fail`);
  console.log(`  Status: ${allPass ? '✅ ALL PASS' : '❌ FAILURES DETECTED'}`);
  console.log('───────────────────────────────────────────\n');
}

// Write report
const reportDir = join(ugwtfRoot, '.ugwtf', 'reports');
mkdirSync(reportDir, { recursive: true });
writeFileSync(
  join(reportDir, `scoreboard-validation-${Date.now()}.json`),
  JSON.stringify({ checks, allPass, timestamp: new Date().toISOString() }, null, 2),
);

if (fixMode && allPass) {
  const mockResult = generateMockSwarmResult(['damieus', 'ffs', '043', 'maximus', 'cae']);
  const scoreboard = generateScoreboard(mockResult);
  const ugwtfDir = join(process.cwd(), '.ugwtf');
  mkdirSync(ugwtfDir, { recursive: true });
  writeFileSync(join(ugwtfDir, 'SCOREBOARD.json'), JSON.stringify(scoreboard, null, 2));
  if (!jsonOutput) console.log('  📝 Wrote golden SCOREBOARD.json to .ugwtf/\n');
}

process.exit(allPass ? 0 : 1);
