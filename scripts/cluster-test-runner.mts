#!/usr/bin/env npx tsx
/**
 * cluster-test-runner.mts — Run cluster-specific tests with coverage + reporting
 *
 * Multi-agent swarm script that runs test suites by cluster domain,
 * produces coverage summaries, and detects regressions.
 * Reduces token usage by automating what would be many manual test runs.
 *
 * Usage:
 *   npx tsx scripts/cluster-test-runner.mts                    # All test files
 *   npx tsx scripts/cluster-test-runner.mts --cluster integration  # Only integration tests
 *   npx tsx scripts/cluster-test-runner.mts --coverage         # With coverage
 *   npx tsx scripts/cluster-test-runner.mts --json             # JSON output
 *
 * Examples:
 *   npx tsx scripts/cluster-test-runner.mts --cluster clusters --cluster output
 *   npx tsx scripts/cluster-test-runner.mts --coverage --json > test-report.json
 */
import { execSync } from 'node:child_process';
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ugwtfRoot = resolve(__dirname, '..');
const reportDir = join(ugwtfRoot, '.ugwtf', 'reports');

// ── CLI parsing ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const withCoverage = args.includes('--coverage');
const clusterFlags: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--cluster' && args[i + 1]) {
    clusterFlags.push(args[i + 1]);
    i++;
  }
}

// ── Test file discovery ──────────────────────────────────────────────────
interface TestCluster {
  id: string;
  name: string;
  files: string[];
}

function discoverTestClusters(): TestCluster[] {
  const clusters: TestCluster[] = [
    { id: 'clusters', name: 'Cluster Registration', files: ['src/clusters/clusters.test.ts'] },
    { id: 'integration', name: 'Integration (visual-audit)', files: ['src/integration.test.ts'] },
    { id: 'orchestrator', name: 'Orchestrator', files: ['src/orchestrator.test.ts'] },
    { id: 'output', name: 'Output & Scoreboard', files: ['src/output/output.test.ts'] },
    { id: 'swarm', name: 'Swarm Executor', files: ['src/swarm/executor.test.ts'] },
    { id: 'utils', name: 'Utilities', files: ['src/utils/logger.test.ts', 'src/utils/common.test.ts', 'src/utils/fs.test.ts'] },
    { id: 'config', name: 'Configuration', files: ['src/config/repo-registry.test.ts'] },
    { id: 'cli', name: 'CLI / Index', files: ['src/index.test.ts'] },
  ];

  if (clusterFlags.length > 0) {
    return clusters.filter(c => clusterFlags.includes(c.id));
  }
  return clusters;
}

// ── Test runner ──────────────────────────────────────────────────────────
interface ClusterTestResult {
  cluster: string;
  name: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  success: boolean;
  output: string;
}

function runTestCluster(cluster: TestCluster): ClusterTestResult {
  const files = cluster.files.join(' ');
  const coverageFlag = withCoverage ? '--coverage' : '';
  const cmd = `npx vitest run ${files} ${coverageFlag} --reporter=verbose 2>&1`;

  const start = Date.now();
  let output = '';
  let success = false;

  try {
    output = execSync(cmd, {
      cwd: ugwtfRoot,
      encoding: 'utf-8',
      timeout: 120_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    success = true;
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    output = (e.stdout ?? '') + (e.stderr ?? '');
    success = false;
  }

  const duration = Date.now() - start;

  // Parse test counts from vitest output
  const passMatch = output.match(/(\d+) passed/);
  const failMatch = output.match(/(\d+) failed/);
  const skipMatch = output.match(/(\d+) skipped/);

  return {
    cluster: cluster.id,
    name: cluster.name,
    passed: passMatch ? Number(passMatch[1]) : 0,
    failed: failMatch ? Number(failMatch[1]) : 0,
    skipped: skipMatch ? Number(skipMatch[1]) : 0,
    duration,
    success,
    output: output.slice(-1000),
  };
}

// ── Execution ────────────────────────────────────────────────────────────
const clusters = discoverTestClusters();
const results: ClusterTestResult[] = [];

if (!jsonOutput) {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║     UGWTF Cluster Test Runner            ║');
  console.log('╚══════════════════════════════════════════╝\n');
  console.log(`Running ${clusters.length} test cluster(s)...\n`);
}

for (const cluster of clusters) {
  if (!jsonOutput) {
    process.stdout.write(`  ⏳ ${cluster.name} (${cluster.files.length} file${cluster.files.length > 1 ? 's' : ''})...`);
  }

  const result = runTestCluster(cluster);
  results.push(result);

  if (!jsonOutput) {
    const icon = result.success ? '✅' : '❌';
    const counts = `${result.passed}P ${result.failed}F ${result.skipped}S`;
    console.log(` ${icon} ${counts} (${result.duration}ms)`);
  }
}

// ── Summary ──────────────────────────────────────────────────────────────
const totalPassed = results.reduce((s, r) => s + r.passed, 0);
const totalFailed = results.reduce((s, r) => s + r.failed, 0);
const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);
const allSuccess = results.every(r => r.success);
const totalDuration = results.reduce((s, r) => s + r.duration, 0);

const report = {
  generatedAt: new Date().toISOString(),
  clusters: results.map(r => ({
    cluster: r.cluster,
    name: r.name,
    passed: r.passed,
    failed: r.failed,
    skipped: r.skipped,
    duration: r.duration,
    success: r.success,
  })),
  summary: {
    totalClusters: results.length,
    totalPassed,
    totalFailed,
    totalSkipped,
    totalTests: totalPassed + totalFailed + totalSkipped,
    allSuccess,
    duration: totalDuration,
  },
};

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('\n───────────────────────────────────────────');
  console.log(`  Total: ${report.summary.totalTests} tests | ✅ ${totalPassed} | ❌ ${totalFailed} | ⏭️ ${totalSkipped}`);
  console.log(`  Duration: ${totalDuration}ms`);
  console.log(`  Status: ${allSuccess ? '✅ ALL PASS' : '❌ FAILURES DETECTED'}`);
  console.log('───────────────────────────────────────────\n');
}

// Write report
mkdirSync(reportDir, { recursive: true });
const reportPath = join(reportDir, `cluster-tests-${Date.now()}.json`);
writeFileSync(reportPath, JSON.stringify(report, null, 2));
if (!jsonOutput) {
  console.log(`  Report: ${reportPath}\n`);
}

process.exit(allSuccess ? 0 : 1);
