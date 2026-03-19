#!/usr/bin/env npx tsx
/**
 * swarm-quality-gate.mts — Parallel quality gates across all repos via swarm
 *
 * Runs tsc, lint, build across registered repos using concurrency control.
 * Generates a structured JSON report + styled terminal output.
 *
 * Usage:
 *   npx tsx scripts/swarm-quality-gate.mts [repos...] [--concurrency N] [--json]
 *
 * Examples:
 *   npx tsx scripts/swarm-quality-gate.mts               # All repos
 *   npx tsx scripts/swarm-quality-gate.mts damieus ffs    # Specific repos
 *   npx tsx scripts/swarm-quality-gate.mts --concurrency 5 --json
 */
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ugwtfRoot = resolve(__dirname, '..');

// ── Repo registry (mirrors src/config/repo-registry.ts) ─────────────────
const REPO_PATHS: Record<string, string> = {
  damieus: resolve(ugwtfRoot, '../damieus-com-migration'),
  ffs:     resolve(ugwtfRoot, '../flipflops-sundays-reboot'),
  '043':   resolve(ugwtfRoot, '../one4three-co-next-app'),
  maximus: resolve(ugwtfRoot, '../maximus-ai'),
  cae:     resolve(ugwtfRoot, '../cae-luxury-hair'),
};

// ── CLI parsing ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const concurrencyIdx = args.indexOf('--concurrency');
const concurrency = concurrencyIdx >= 0 ? Number(args[concurrencyIdx + 1]) : 3;
const targetRepos = args.filter(a => !a.startsWith('--') && a !== String(concurrency));
const repos = targetRepos.length > 0
  ? targetRepos.filter(r => r in REPO_PATHS)
  : Object.keys(REPO_PATHS);

// ── Types ────────────────────────────────────────────────────────────────
interface GateResult {
  gate: 'tsc' | 'lint' | 'build';
  pass: boolean;
  duration: number;
  output: string;
}

interface RepoReport {
  repo: string;
  path: string;
  gates: GateResult[];
  allPass: boolean;
  totalDuration: number;
}

// ── Gate runner ──────────────────────────────────────────────────────────
function runGate(name: 'tsc' | 'lint' | 'build', cwd: string): GateResult {
  const commands: Record<string, string> = {
    tsc:   'npx tsc --noEmit',
    lint:  'npm run lint -- --quiet',
    build: 'npm run build',
  };

  const start = Date.now();
  try {
    const out = execSync(commands[name], {
      cwd,
      encoding: 'utf-8',
      timeout: 180_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { gate: name, pass: true, duration: Date.now() - start, output: out.slice(-500) };
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string };
    const output = (e.stderr ?? e.stdout ?? '').slice(-800);
    return { gate: name, pass: false, duration: Date.now() - start, output };
  }
}

// ── Repo quality runner ──────────────────────────────────────────────────
function auditRepo(alias: string): RepoReport {
  const path = REPO_PATHS[alias];
  if (!existsSync(join(path, 'package.json'))) {
    return { repo: alias, path, gates: [], allPass: false, totalDuration: 0 };
  }

  const gates: GateResult[] = [];
  for (const gate of ['tsc', 'lint', 'build'] as const) {
    // Skip gates if config is missing
    if (gate === 'tsc' && !existsSync(join(path, 'tsconfig.json'))) continue;
    gates.push(runGate(gate, path));
  }

  const allPass = gates.every(g => g.pass);
  const totalDuration = gates.reduce((sum, g) => sum + g.duration, 0);
  return { repo: alias, path, gates, allPass, totalDuration };
}

// ── Concurrency limiter ──────────────────────────────────────────────────
async function withConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  max: number,
): Promise<T[]> {
  const results: T[] = [];
  const executing = new Set<Promise<void>>();
  for (const task of tasks) {
    const p = task().then(r => { results.push(r); });
    executing.add(p);
    p.finally(() => executing.delete(p));
    if (executing.size >= max) await Promise.race(executing);
  }
  await Promise.all(executing);
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now();

  if (!jsonOutput) {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  UGWTF Swarm Quality Gate                ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log(`Repos: ${repos.join(', ')} | Concurrency: ${concurrency}\n`);
  }

  const reports = await withConcurrency(
    repos.map(r => () => Promise.resolve(auditRepo(r))),
    concurrency,
  );

  // ── JSON output ─────────────────────────────────────────────────────
  if (jsonOutput) {
    const result = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - startedAt,
      repos: reports,
      summary: {
        total: reports.length,
        passing: reports.filter(r => r.allPass).length,
        failing: reports.filter(r => !r.allPass).length,
      },
    };
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // ── Styled terminal output ──────────────────────────────────────────
  for (const report of reports) {
    const icon = report.allPass ? '✅' : '❌';
    console.log(`\n${icon} ${report.repo} (${(report.totalDuration / 1000).toFixed(1)}s)`);
    for (const g of report.gates) {
      const gIcon = g.pass ? '  ✓' : '  ✗';
      console.log(`${gIcon} ${g.gate} (${(g.duration / 1000).toFixed(1)}s)`);
      if (!g.pass) {
        // Show last 3 lines of error
        const errLines = g.output.trim().split('\n').slice(-3);
        for (const line of errLines) console.log(`    ${line}`);
      }
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────
  const passing = reports.filter(r => r.allPass).length;
  const total = reports.length;
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Quality: ${passing}/${total} repos passing | ${((Date.now() - startedAt) / 1000).toFixed(1)}s total`);

  if (passing < total) {
    console.log('\nFailing repos:');
    for (const r of reports.filter(r => !r.allPass)) {
      const failedGates = r.gates.filter(g => !g.pass).map(g => g.gate);
      console.log(`  ✗ ${r.repo}: ${failedGates.join(', ')}`);
    }
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
