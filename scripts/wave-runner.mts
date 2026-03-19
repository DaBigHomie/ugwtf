#!/usr/bin/env npx tsx
/**
 * wave-runner.mts — Orchestrate P4 implementation waves via agent clusters
 *
 * Reads P4-IMPLEMENTATION-CHECKLIST.md, identifies remaining items per wave,
 * validates prerequisites (build/test), and generates execution plans.
 *
 * Usage:
 *   npx tsx scripts/wave-runner.mts status              # Show wave progress
 *   npx tsx scripts/wave-runner.mts validate [wave]     # Pre-flight for a wave
 *   npx tsx scripts/wave-runner.mts plan [wave]         # Generate execution plan
 *
 * Examples:
 *   npx tsx scripts/wave-runner.mts status
 *   npx tsx scripts/wave-runner.mts validate 2
 *   npx tsx scripts/wave-runner.mts plan 2 --json
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ugwtfRoot = resolve(__dirname, '..');
const aoRoot = resolve(ugwtfRoot, '../audit-orchestrator');

const args = process.argv.slice(2);
const command = args[0] ?? 'status';
const waveArg = Number(args[1]) || 0;
const jsonFlag = args.includes('--json');

// ── Wave definitions ─────────────────────────────────────────────────────
interface WaveItem {
  id: string;
  title: string;
  wave: number;
  done: boolean;
  deps: string[];
}

const WAVE_ITEMS: WaveItem[] = [
  // Wave 1 — Type Unification (COMPLETE)
  { id: 'C1.1', title: 'UGWTFPlugin interface exists', wave: 1, done: true, deps: [] },
  { id: 'C1.2', title: 'PluginRegistry in types.ts', wave: 1, done: true, deps: [] },
  { id: 'C1.3', title: 'ugwtf-plugin.ts implements UGWTFPlugin', wave: 1, done: true, deps: ['C1.1'] },
  { id: 'C1.4', title: 'Plugin loader discovers audit-orchestrator', wave: 1, done: false, deps: ['C1.3'] },
  { id: 'C1.5', title: 'Plugin test passing', wave: 1, done: true, deps: ['C1.3'] },
  { id: 'C1.6', title: 'Doc: plugin usage in README', wave: 1, done: true, deps: [] },
  { id: 'C2.1', title: 'Types exported from ugwtf/types', wave: 1, done: true, deps: [] },
  { id: 'C2.2', title: 'audit-orchestrator imports canonical types', wave: 1, done: true, deps: ['C2.1'] },
  { id: 'C2.3', title: 'Local duplicate types removed', wave: 1, done: true, deps: ['C2.2'] },
  { id: 'C2.4', title: 'tsc pass in audit-orchestrator', wave: 1, done: true, deps: ['C2.3'] },
  { id: 'C2.5', title: 'tsc pass in ugwtf', wave: 1, done: true, deps: ['C2.3'] },
  { id: 'C2.6', title: 'Agent[] cast removed', wave: 1, done: true, deps: ['C2.3'] },
  { id: 'C2.7', title: '132 tests still pass', wave: 1, done: true, deps: ['C2.6'] },
  { id: 'C7.1', title: 'Decision: keep file: link for now', wave: 1, done: true, deps: [] },
  { id: 'R1.2', title: 'file: link in both package.json', wave: 1, done: true, deps: [] },

  // Wave 2 — Audit Integration
  { id: 'C4.1', title: 'Run audit with visual-audit cluster', wave: 2, done: false, deps: ['C2.7'] },
  { id: 'C4.2', title: 'Verify findings appear in SCOREBOARD.json', wave: 2, done: false, deps: ['C4.1'] },
  { id: 'C8.1', title: 'Integration test: cluster register + execute', wave: 2, done: false, deps: ['C2.7'] },
  { id: 'C8.2', title: 'Integration test: agent results aggregate', wave: 2, done: false, deps: ['C8.1'] },

  // Wave 3 — Documentation
  { id: 'C6.1', title: 'README: audit-orchestrator as plugin', wave: 3, done: false, deps: ['C4.2'] },
  { id: 'C6.2', title: 'README: --cluster visual-audit usage', wave: 3, done: false, deps: ['C6.1'] },
  { id: 'C6.3', title: 'README: swarm automation scripts', wave: 3, done: false, deps: [] },

  // Wave 4 — GitHub Actions CI/CD
  { id: 'C10', title: 'ugwtf-audit.yml (nightly + manual)', wave: 4, done: false, deps: ['C4.2'] },
  { id: 'C11', title: 'ugwtf-deploy.yml (deploy on merge)', wave: 4, done: false, deps: ['C10'] },
  { id: 'C12', title: 'Fine-grained PAT configured', wave: 4, done: false, deps: [] },
  { id: 'C13', title: 'npx ugwtf deploy --all from Actions', wave: 4, done: false, deps: ['C11', 'C12'] },
  { id: 'C14', title: 'PR comment with SCOREBOARD', wave: 4, done: false, deps: ['C10'] },
  { id: 'C15', title: 'Slack/Discord webhook on regression', wave: 4, done: false, deps: ['C14'] },

  // Wave 5 — Open Risks
  { id: 'R2', title: 'gh CLI fallback to REST API', wave: 5, done: false, deps: [] },
  { id: 'R4', title: '.env loader (dotenv or custom)', wave: 5, done: false, deps: [] },
  { id: 'C7.2', title: 'Publish audit-orchestrator to npm', wave: 5, done: false, deps: ['C8.2'] },
  { id: 'C7.3', title: 'Version-lock in ugwtf package.json', wave: 5, done: false, deps: ['C7.2'] },
];

// ── Helpers ──────────────────────────────────────────────────────────────
function getWaveItems(wave: number): WaveItem[] {
  return WAVE_ITEMS.filter(i => i.wave === wave);
}

function getRemaining(wave: number): WaveItem[] {
  return getWaveItems(wave).filter(i => !i.done);
}

function waveProgress(wave: number): { done: number; total: number; pct: number } {
  const items = getWaveItems(wave);
  const done = items.filter(i => i.done).length;
  return { done, total: items.length, pct: items.length > 0 ? Math.round((done / items.length) * 100) : 0 };
}

function runCheck(label: string, cmd: string, cwd: string): { pass: boolean; output: string } {
  try {
    const output = execSync(cmd, { cwd, encoding: 'utf-8', timeout: 120_000, stdio: ['pipe', 'pipe', 'pipe'] });
    return { pass: true, output: output.slice(-200) };
  } catch (err) {
    return { pass: false, output: ((err as { stderr?: string }).stderr ?? '').slice(-300) };
  }
}

// ── Commands ─────────────────────────────────────────────────────────────

function showStatus() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  P4 Wave Progress Dashboard                     ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const totalDone = WAVE_ITEMS.filter(i => i.done).length;
  const totalItems = WAVE_ITEMS.length;

  for (let w = 1; w <= 5; w++) {
    const prog = waveProgress(w);
    const bar = '█'.repeat(Math.floor(prog.pct / 5)) + '░'.repeat(20 - Math.floor(prog.pct / 5));
    const label = ['Type Unification', 'Audit Integration', 'Documentation', 'GitHub Actions', 'Open Risks'][w - 1];
    console.log(`Wave ${w}: ${label}`);
    console.log(`  ${bar} ${prog.pct}% (${prog.done}/${prog.total})`);

    const remaining = getRemaining(w);
    if (remaining.length > 0) {
      for (const item of remaining) {
        const depsMet = item.deps.every(d => WAVE_ITEMS.find(i => i.id === d)?.done);
        const icon = depsMet ? '○' : '⊘';
        console.log(`  ${icon} ${item.id}: ${item.title}${!depsMet ? ' (blocked)' : ''}`);
      }
    }
    console.log();
  }

  console.log(`${'═'.repeat(52)}`);
  console.log(`Overall: ${totalDone}/${totalItems} (${Math.round((totalDone / totalItems) * 100)}%)`);
  console.log(`\nNext actionable: Wave ${getNextWave()}`);
}

function getNextWave(): number {
  for (let w = 1; w <= 5; w++) {
    if (getRemaining(w).length > 0) return w;
  }
  return 0;
}

function validateWave(wave: number) {
  console.log(`\n🔍 Validating prerequisites for Wave ${wave}...\n`);

  const checks: Array<{ label: string; cmd: string; cwd: string }> = [
    { label: 'ugwtf tsc', cmd: 'npx tsc --noEmit', cwd: ugwtfRoot },
    { label: 'ugwtf tests', cmd: 'npx vitest run', cwd: ugwtfRoot },
  ];

  if (existsSync(aoRoot)) {
    checks.push(
      { label: 'audit-orchestrator tsc', cmd: 'npx tsc --noEmit', cwd: aoRoot },
      { label: 'audit-orchestrator build', cmd: 'npm run build', cwd: aoRoot },
    );
  }

  let allPass = true;
  for (const check of checks) {
    const result = runCheck(check.label, check.cmd, check.cwd);
    const icon = result.pass ? '✓' : '✗';
    console.log(`  ${icon} ${check.label}`);
    if (!result.pass) {
      allPass = false;
      const lines = result.output.trim().split('\n').slice(-2);
      for (const line of lines) console.log(`    ${line}`);
    }
  }

  console.log(`\n${allPass ? '✅ All prerequisites pass — ready for Wave ' + wave : '❌ Fix failures before proceeding'}`);

  // Show wave items
  const items = getRemaining(wave);
  if (items.length > 0) {
    console.log(`\nItems to implement (${items.length}):`);
    for (const item of items) {
      console.log(`  ○ ${item.id}: ${item.title}`);
    }
  }

  return allPass;
}

function planWave(wave: number) {
  const items = getRemaining(wave);
  if (items.length === 0) {
    console.log(`Wave ${wave} is complete — nothing to plan.`);
    return;
  }

  // Build dependency-ordered execution plan
  const plan: Array<{ step: number; items: WaveItem[]; parallel: boolean }> = [];
  const done = new Set(WAVE_ITEMS.filter(i => i.done).map(i => i.id));
  const remaining = [...items];
  let step = 1;

  while (remaining.length > 0) {
    const ready = remaining.filter(i => i.deps.every(d => done.has(d)));
    if (ready.length === 0) {
      console.error('Circular dependency or blocked items:', remaining.map(i => i.id));
      break;
    }

    plan.push({ step, items: ready, parallel: ready.length > 1 });
    for (const item of ready) {
      done.add(item.id);
      remaining.splice(remaining.indexOf(item), 1);
    }
    step++;
  }

  if (jsonFlag) {
    console.log(JSON.stringify({ wave, steps: plan }, null, 2));
    return;
  }

  console.log(`\n📋 Execution Plan — Wave ${wave}\n`);
  for (const s of plan) {
    const mode = s.parallel ? '(parallel)' : '(sequential)';
    console.log(`Step ${s.step} ${mode}:`);
    for (const item of s.items) {
      console.log(`  → ${item.id}: ${item.title}`);
    }
  }
  console.log(`\nTotal: ${items.length} items in ${plan.length} steps`);
}

// ── Main ─────────────────────────────────────────────────────────────────
switch (command) {
  case 'status':
    showStatus();
    break;
  case 'validate':
    validateWave(waveArg || getNextWave());
    break;
  case 'plan':
    planWave(waveArg || getNextWave());
    break;
  default:
    console.log('Usage: npx tsx scripts/wave-runner.mts [status|validate|plan] [wave] [--json]');
}
