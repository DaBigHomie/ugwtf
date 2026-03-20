#!/usr/bin/env npx tsx
/**
 * 40X Publish Readiness Audit
 * Checks all 40 tasks from 40X-PUBLISH-PLAN.md + P4 carryover from GAP-ANALYSIS
 * Run: npx tsx scripts/audit-publish-readiness.mts
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const p = (...segs: string[]) => join(ROOT, ...segs);

// ── Helpers ──────────────────────────────────────────────────────
type Status = '✅ DONE' | '❌ NOT DONE' | '⚠️ PARTIAL' | '🔶 DEFERRED' | 'ℹ️ N/A';

interface Check {
  task: string;
  wave: string;
  priority: string;
  status: Status;
  detail: string;
}

const results: Check[] = [];
function check(wave: string, task: string, priority: string, status: Status, detail: string) {
  results.push({ wave, task, priority, status, detail });
}

function fileExists(rel: string): boolean { return existsSync(p(rel)); }
function readJson(rel: string): any { return JSON.parse(readFileSync(p(rel), 'utf-8')); }
function readText(rel: string): string { return readFileSync(p(rel), 'utf-8'); }
function exec(cmd: string): string {
  try { return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', timeout: 60_000, stdio: ['pipe','pipe','pipe'] }).trim(); }
  catch (e: any) { return e.stdout?.toString().trim() ?? e.message; }
}
function countFiles(dir: string, pattern: RegExp): number {
  if (!existsSync(p(dir))) return 0;
  let count = 0;
  const walk = (d: string) => {
    for (const e of readdirSync(d)) {
      const fp = join(d, e);
      if (statSync(fp).isDirectory()) walk(fp);
      else if (pattern.test(e)) count++;
    }
  };
  walk(p(dir));
  return count;
}

console.log('🔍 UGWTF 40X Publish Readiness Audit');
console.log('─'.repeat(60));
console.log(`📅 ${new Date().toISOString().slice(0, 10)}`);
console.log(`📁 ${ROOT}\n`);

// ── Wave 1: Build Hygiene (Tasks 1-5) ──────────────────────────

const tsconfig = readJson('tsconfig.json');
const excludes: string[] = tsconfig.exclude ?? [];
const hasTestExclude = excludes.some((e: string) => e.includes('test'));
const hasMockExclude = excludes.some((e: string) => e.includes('mock') || e.includes('__mocks__'));
check('W1', 'T1: Exclude test files from tsconfig', '🔴 BLOCK',
  hasTestExclude ? '✅ DONE' : '❌ NOT DONE',
  `exclude: ${JSON.stringify(excludes)}`);

const mockInDist = countFiles('dist/__mocks__', /./);
check('W1', 'T2: No __mocks__ in dist', '🔴 BLOCK',
  mockInDist === 0 ? '✅ DONE' : '❌ NOT DONE',
  `dist/__mocks__ files: ${mockInDist}`);

const testInDist = countFiles('dist', /\.test\./);
check('W1', 'T3: No test files in dist', '🔴 BLOCK',
  testInDist === 0 ? '✅ DONE' : '❌ NOT DONE',
  `dist/**/*.test.* files: ${testInDist}`);

// T4: Verify tests pass (run vitest)
const testOutput = exec('npx vitest run --reporter=json 2>/dev/null || npx vitest run 2>&1 | tail -5');
const testMatch = testOutput.match(/(\d+)\s+passed/);
const testCount = testMatch ? parseInt(testMatch[1]) : 0;
const testFileMatch = testOutput.match(/(\d+)\s+files?/i) ?? testOutput.match(/Test Files\s+(\d+)/);
const testFileCount = testFileMatch ? parseInt(testFileMatch[1]) : 0;
check('W1', 'T4: Tests pass after tsconfig change', '🔴 BLOCK',
  testCount >= 383 ? '✅ DONE' : testCount > 0 ? '⚠️ PARTIAL' : '❌ NOT DONE',
  `${testCount} tests passed`);

// T5: Dry run publish (check file count)
const packOutput = exec('npm pack --dry-run 2>&1');
const packLines = packOutput.split('\n').filter(l => l.includes('npm'));
const filecountMatch = packOutput.match(/total files:\s*(\d+)/i);
const sizeMatch = packOutput.match(/unpacked size:\s*([\d.]+\s*\w+)/i);
const packedFileCount = filecountMatch ? parseInt(filecountMatch[1]) : -1;
check('W1', 'T5: Publish dry-run clean', '🔴 BLOCK',
  packedFileCount > 0 && packedFileCount < 120 ? '✅ DONE' : '⚠️ PARTIAL',
  `Tarball: ${packedFileCount} files, ${sizeMatch?.[1] ?? 'unknown size'}`);

// ── Wave 2: Dependency Resolution (Tasks 6-10) ──────────────────
const pkg = readJson('package.json');
const deps: Record<string, string> = pkg.dependencies ?? {};
const hasFileLink = Object.values(deps).some(v => typeof v === 'string' && v.startsWith('file:'));
const aoVersion = deps['@dabighomie/audit-orchestrator'] ?? 'NOT FOUND';
check('W2', 'T6-8: audit-orchestrator dep resolved', '🔴 BLOCK',
  !hasFileLink ? '✅ DONE' : '❌ NOT DONE',
  `Current: "${aoVersion}" — file: link ${hasFileLink ? 'PRESENT' : 'removed'}`);

// T9: Clean install works
const tscOutput = exec('npx tsc --noEmit 2>&1');
const tscErrors = (tscOutput.match(/error TS/g) ?? []).length;
check('W2', 'T9: tsc --noEmit passes', '🔴 BLOCK',
  tscErrors === 0 ? '✅ DONE' : '❌ NOT DONE',
  `${tscErrors} TypeScript errors`);

// T10: monorepo.test.ts updated
const hasMonorepoTest = fileExists('src/monorepo.test.ts');
let monoTestStatus: Status = 'ℹ️ N/A';
let monoTestDetail = 'File not found — may have been removed or renamed';
if (hasMonorepoTest) {
  const monoTest = readText('src/monorepo.test.ts');
  const hasFileRef = monoTest.includes('file:');
  monoTestStatus = hasFileRef ? '❌ NOT DONE' : '✅ DONE';
  monoTestDetail = hasFileRef ? 'Still references file: link' : 'No file: references';
}
check('W2', 'T10: monorepo.test.ts updated', '🔴 BLOCK', monoTestStatus, monoTestDetail);

// ── Wave 3: Package Metadata (Tasks 11-15) ──────────────────────
check('W3', 'T11: repo field in package.json', '🔴 BLOCK',
  pkg.repository?.url ? '✅ DONE' : '❌ NOT DONE',
  `repository.url: ${pkg.repository?.url ?? 'MISSING'}`);

check('W3', 'T12: engines field', '🟠 HIGH',
  pkg.engines?.node ? '✅ DONE' : '❌ NOT DONE',
  `engines.node: ${pkg.engines?.node ?? 'MISSING'}`);

// T13: npm pkg fix (bin name clean)
const binVal = pkg.bin?.ugwtf;
check('W3', 'T13: bin entry clean', '🟡 MED',
  binVal ? '✅ DONE' : '❌ NOT DONE',
  `bin.ugwtf: ${binVal ?? 'MISSING'}`);

// T14: templates in files
const filesArr: string[] = pkg.files ?? [];
check('W3', 'T14: templates in files array', '🟡 MED',
  filesArr.includes('templates') ? '✅ DONE' : '❌ NOT DONE',
  `files: ${JSON.stringify(filesArr)}`);

check('W3', 'T15: publishConfig.access', '🟡 MED',
  pkg.publishConfig?.access === 'public' ? '✅ DONE' : '❌ NOT DONE',
  `publishConfig: ${JSON.stringify(pkg.publishConfig ?? {})}`);

// ── Wave 4: Legal & Compliance (Tasks 16-19) ────────────────────
check('W4', 'T16: LICENSE file exists', '🟠 HIGH',
  fileExists('LICENSE') ? '✅ DONE' : '❌ NOT DONE',
  fileExists('LICENSE') ? `${statSync(p('LICENSE')).size} bytes` : 'Missing');

const aoLicense = fileExists('packages/audit-orchestrator/LICENSE');
check('W4', 'T17: audit-orchestrator LICENSE', '🟠 HIGH',
  aoLicense ? '✅ DONE' : '⚠️ PARTIAL',
  aoLicense ? 'Exists' : 'Missing — may not matter if bundled differently');

const readme = fileExists('README.md') ? readText('README.md') : '';
const hasPrivateLicense = readme.includes('Private') && readme.toLowerCase().includes('license');
check('W4', 'T18: README license section matches MIT', '🟡 MED',
  !hasPrivateLicense ? '✅ DONE' : '❌ NOT DONE',
  hasPrivateLicense ? 'README says Private — contradicts MIT' : 'No "Private" in license section');

check('W4', 'T19: LICENSE in npm tarball', '🟢 LOW',
  fileExists('LICENSE') ? '✅ DONE' : '❌ NOT DONE',
  'npm auto-includes LICENSE');

// ── Wave 5: Documentation Accuracy (Tasks 20-27) ────────────────
const agents = fileExists('AGENTS.md') ? readText('AGENTS.md') : '';
const agentsHas383 = agents.includes('383');
const agentsHas272 = agents.includes('272');
check('W5', 'T20: AGENTS.md test count = 383', '🟠 HIGH',
  agentsHas383 && !agentsHas272 ? '✅ DONE' : agentsHas272 ? '❌ NOT DONE' : '⚠️ PARTIAL',
  `Has 383: ${agentsHas383}, Has stale 272: ${agentsHas272}`);

const copilotInstr = fileExists('.github/copilot-instructions.md') ? readText('.github/copilot-instructions.md') : '';
const ciHas261 = copilotInstr.includes('261');
const ciHas383 = copilotInstr.includes('383');
check('W5', 'T21: copilot-instructions test count', '🟠 HIGH',
  ciHas383 && !ciHas261 ? '✅ DONE' : ciHas261 ? '❌ NOT DONE' : '⚠️ PARTIAL',
  `Has 383: ${ciHas383}, Has stale 261: ${ciHas261}`);

const testing05 = fileExists('docs/agent-guide/05-TESTING.md') ? readText('docs/agent-guide/05-TESTING.md') : '';
const t05Has261 = testing05.includes('261');
const t05Has383 = testing05.includes('383');
check('W5', 'T22: 05-TESTING.md updated', '🟠 HIGH',
  t05Has383 && !t05Has261 ? '✅ DONE' : t05Has261 ? '❌ NOT DONE' : '⚠️ PARTIAL',
  `Has 383: ${t05Has383}, Has stale 261: ${t05Has261}`);

const readmeHas156 = readme.includes('156 test');
const readmeHas383 = readme.includes('383');
check('W5', 'T23: README test count = 383', '🟠 HIGH',
  readmeHas383 && !readmeHas156 ? '✅ DONE' : readmeHas156 ? '❌ NOT DONE' : '⚠️ PARTIAL',
  `Has 383: ${readmeHas383}, Has stale 156: ${readmeHas156}`);

const readmeAgentCount = readme.match(/(\d+)\s*agents?\s*(across|in)/i);
check('W5', 'T24: README agent/cluster count', '🟡 MED',
  readmeAgentCount ? '⚠️ PARTIAL' : 'ℹ️ N/A',
  `Found: "${readmeAgentCount?.[0] ?? 'no match'}"`);

const auditResults = fileExists('docs/AUDIT-RESULTS.json') ? readText('docs/AUDIT-RESULTS.json') : '';
const hasAbsPath = auditResults.includes('/Users/');
check('W5', 'T25: AUDIT-RESULTS.json no hardcoded paths', '🟡 MED',
  !hasAbsPath ? '✅ DONE' : '❌ NOT DONE',
  hasAbsPath ? 'Contains /Users/ paths' : 'Clean — no absolute paths');

const gaps09 = fileExists('docs/agent-guide/09-GAPS.md') ? readText('docs/agent-guide/09-GAPS.md') : '';
check('W5', 'T26: 09-GAPS.md updated', '🟡 MED',
  gaps09.includes('PR #10') || gaps09.includes('resolved') ? '✅ DONE' : '⚠️ PARTIAL',
  gaps09.length > 0 ? `${gaps09.length} chars` : 'File missing');

// T27: copilot-instructions stats
const ciAgentMatch = copilotInstr.match(/(\d+)\s*agents/);
check('W5', 'T27: copilot-instructions stats aligned', '🟡 MED',
  ciHas383 ? '✅ DONE' : '⚠️ PARTIAL',
  `Agent count: ${ciAgentMatch?.[1] ?? '?'}, Test 383: ${ciHas383}`);

// ── Wave 6: Publish Infrastructure (Tasks 28-33) ────────────────
check('W6', 'T28: CHANGELOG.md exists', '🟡 MED',
  fileExists('CHANGELOG.md') ? '✅ DONE' : '❌ NOT DONE',
  fileExists('CHANGELOG.md') ? `${statSync(p('CHANGELOG.md')).size} bytes` : 'Missing');

check('W6', 'T29: .npmignore exists', '🟢 LOW',
  fileExists('.npmignore') ? '✅ DONE' : '❌ NOT DONE',
  fileExists('.npmignore') ? readText('.npmignore').split('\n').length + ' rules' : 'Missing');

const releaseYml = fileExists('.github/workflows/release.yml');
check('W6', 'T30: release.yml workflow', '🟡 MED',
  releaseYml ? '✅ DONE' : '❌ NOT DONE',
  releaseYml ? 'Exists' : 'Missing');

check('W6', 'T31: Version strategy', '🟡 MED',
  pkg.version === '1.0.0' ? '✅ DONE' : '⚠️ PARTIAL',
  `Version: ${pkg.version}`);

// T32: packages/ not in tarball
const packHasPackages = packOutput.includes('packages/');
check('W6', 'T32: packages/ excluded from tarball', '🟢 LOW',
  !packHasPackages ? '✅ DONE' : '❌ NOT DONE',
  packHasPackages ? 'packages/ found in pack output' : 'Excluded');

// T33: shebang in dist/index.js
const distIndex = fileExists('dist/index.js') ? readText('dist/index.js').slice(0, 100) : '';
const hasShebang = distIndex.startsWith('#!/usr/bin/env node');
check('W6', 'T33: Global install (shebang)', '🟡 MED',
  hasShebang ? '✅ DONE' : '❌ NOT DONE',
  hasShebang ? 'Has #!/usr/bin/env node' : 'Missing shebang');

// ── Wave 7: Polish (Tasks 34-38) ────────────────────────────────
check('W7', 'T34: CLAUDE.md exists', '🟢 LOW',
  fileExists('CLAUDE.md') ? '✅ DONE' : '❌ NOT DONE',
  fileExists('CLAUDE.md') ? 'Exists' : 'Missing');

// T35: npm audit
const auditOut = exec('npm audit --omit=dev 2>&1');
const vulnMatch = auditOut.match(/(\d+)\s+vulnerabilit/i);
const vulnCount = vulnMatch ? parseInt(vulnMatch[1]) : 0;
const noVulns = auditOut.includes('found 0') || vulnCount === 0;
check('W7', 'T35: npm audit clean', '🟡 MED',
  noVulns ? '✅ DONE' : '⚠️ PARTIAL',
  noVulns ? '0 vulnerabilities' : `${vulnCount} vulnerabilities`);

// T36: dist exports resolve
const exportsOk = fileExists('dist/index.js') && fileExists('dist/types.js');
check('W7', 'T36: dist exports correct', '🟢 LOW',
  exportsOk ? '✅ DONE' : '❌ NOT DONE',
  `dist/index.js: ${fileExists('dist/index.js')}, dist/types.js: ${fileExists('dist/types.js')}`);

// T37: console.log in prod code
const consoleLogCount = exec('grep -rn "console\\.log" src/ --include="*.ts" | grep -v "\\.test\\." | grep -v "__mocks__" | wc -l').trim();
check('W7', 'T37: No stray console.log', '🟢 LOW',
  parseInt(consoleLogCount) === 0 ? '✅ DONE' : '⚠️ PARTIAL',
  `${consoleLogCount} occurrences in src/ (excl tests/mocks)`);

// T38: Repo configs load
const repoRegistry = fileExists('src/config/repo-registry.ts') ? readText('src/config/repo-registry.ts') : '';
const repos = ['damieus', '043', 'ffs', 'cae', 'maximus'];
const registeredRepos = repos.filter(r => repoRegistry.includes(`'${r}'`) || repoRegistry.includes(`"${r}"`));
check('W7', 'T38: All 5 repos registered', '🟢 LOW',
  registeredRepos.length === 5 ? '✅ DONE' : '⚠️ PARTIAL',
  `Found: ${registeredRepos.join(', ')} (${registeredRepos.length}/5)`);

// ── Wave 8: Publish (Tasks 39-40) ───────────────────────────────
const npmInfoOut = exec('npm info @dabighomie/ugwtf version 2>&1');
const isPublished = !npmInfoOut.includes('404') && !npmInfoOut.includes('ERR');
check('W8', 'T39: Pre-publish checklist', '🔴 BLOCK',
  isPublished ? '✅ DONE' : '⚠️ PARTIAL',
  isPublished ? `Published version: ${npmInfoOut}` : 'Not on npm yet');

check('W8', 'T40: npm publish', '🔴 BLOCK',
  isPublished ? '✅ DONE' : '❌ NOT DONE',
  isPublished ? `Version ${npmInfoOut} on registry` : 'Not published');

// ── P4 Carryover Items (from GAP-ANALYSIS) ──────────────────────
console.log('\n── P4 Carryover Checks ──────────────────────────────');

interface CarryoverCheck {
  id: string;
  desc: string;
  status: Status;
  detail: string;
}
const carryovers: CarryoverCheck[] = [];

function carry(id: string, desc: string, status: Status, detail: string) {
  carryovers.push({ id, desc, status, detail });
}

// C4: Audit results → SCOREBOARD.json
carry('C4', 'Audit results flow into SCOREBOARD.json',
  fileExists('SCOREBOARD.json') ? '✅ DONE' : '❌ NOT DONE',
  fileExists('SCOREBOARD.json') ? 'SCOREBOARD.json exists' : 'Missing');

// C6: README documents audit-orchestrator
const readmeAO = readme.includes('audit-orchestrator');
carry('C6', 'README documents audit-orchestrator as plugin',
  readmeAO ? '✅ DONE' : '❌ NOT DONE',
  readmeAO ? 'Referenced in README' : 'Not mentioned');

// C7: Version lock
carry('C7', 'Version lock (file: vs npm)',
  hasFileLink ? '⚠️ PARTIAL' : '✅ DONE',
  hasFileLink ? 'Still using file: link' : `Using: ${aoVersion}`);

// C8: Integration test
const integrationTest = exec('grep -rl "audit-orchestrator" src/*.test.ts src/**/*.test.ts 2>/dev/null | wc -l').trim();
carry('C8', 'Integration test for audit-orchestrator cluster',
  parseInt(integrationTest) > 0 ? '✅ DONE' : '❌ NOT DONE',
  `${integrationTest} test files reference audit-orchestrator`);

// C10: Nightly audit workflow
carry('C10', 'ugwtf-audit.yml nightly workflow',
  fileExists('.github/workflows/ugwtf-audit.yml') ? '✅ DONE' : '❌ NOT DONE',
  fileExists('.github/workflows/ugwtf-audit.yml') ? 'Exists' : 'Missing');

// C11: Deploy workflow
carry('C11', 'ugwtf-deploy.yml workflow',
  fileExists('.github/workflows/ugwtf-deploy.yml') ? '✅ DONE' : '❌ NOT DONE',
  fileExists('.github/workflows/ugwtf-deploy.yml') ? 'Exists' : 'Missing');

// C12: GitHub App/PAT
carry('C12', 'Fine-grained PAT for all repos', '🔶 DEFERRED', 'Requires manual setup');

// C13: deploy --all from GitHub Actions
carry('C13', 'npx ugwtf deploy --all in CI', '🔶 DEFERRED', 'Needs C11 first');

// C14: SCOREBOARD in PR comment
carry('C14', 'SCOREBOARD posted as PR comment',
  existsSync(p('.github/workflows/ci.yml')) ? '⚠️ PARTIAL' : '❌ NOT DONE',
  'CI exists but PR comment not confirmed');

// C15: Slack/Discord notification
carry('C15', 'Slack/Discord on regression', '🔶 DEFERRED', 'Low priority — no webhook configured');

// C17: Dependabot
carry('C17', 'Dependabot config',
  fileExists('.github/dependabot.yml') ? '✅ DONE' : '❌ NOT DONE',
  fileExists('.github/dependabot.yml') ? 'Exists' : 'Missing');

// C18: Branch protection
carry('C18', 'Branch protection on main', '🔶 DEFERRED', 'Requires GitHub API / Settings');

// C19: Release workflow
carry('C19', 'Release workflow (tag → publish)',
  releaseYml ? '✅ DONE' : '❌ NOT DONE',
  releaseYml ? 'release.yml exists' : 'Missing');

// R1: file: links
carry('R1', 'file: link risk',
  !hasFileLink ? '✅ DONE' : '⚠️ PARTIAL',
  hasFileLink ? 'Still has file: dep' : 'No file: deps');

// R2: gh CLI fallback
const ghExists = exec('which gh 2>/dev/null').length > 0;
carry('R2', 'gh CLI required — no fallback',
  ghExists ? '⚠️ PARTIAL' : '❌ NOT DONE',
  ghExists ? 'gh found on PATH but no graceful fallback' : 'gh not on PATH');

// R4: .env handling
carry('R4', '.env handling',
  fileExists('.env.example') ? '⚠️ PARTIAL' : '❌ NOT DONE',
  fileExists('.env.example') ? '.env.example exists, no auto-load' : 'No .env.example');

// ── Summary ──────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(80));
console.log('📊 40X PUBLISH PLAN — TASK STATUS');
console.log('═'.repeat(80));
console.log('');

const maxTask = Math.max(...results.map(r => r.task.length));
for (const r of results) {
  const pad = ' '.repeat(Math.max(0, maxTask - r.task.length));
  console.log(`  ${r.status}  ${r.task}${pad}  │ ${r.detail}`);
}

const done = results.filter(r => r.status === '✅ DONE').length;
const partial = results.filter(r => r.status === '⚠️ PARTIAL').length;
const notDone = results.filter(r => r.status === '❌ NOT DONE').length;
const na = results.filter(r => r.status === 'ℹ️ N/A').length;
const total = results.length;

console.log('\n' + '═'.repeat(80));
console.log('📊 P4 CARRYOVER STATUS');
console.log('═'.repeat(80));
console.log('');

for (const c of carryovers) {
  console.log(`  ${c.status}  ${c.id}: ${c.desc}  │ ${c.detail}`);
}

const cDone = carryovers.filter(c => c.status === '✅ DONE').length;
const cPartial = carryovers.filter(c => c.status === '⚠️ PARTIAL').length;
const cNotDone = carryovers.filter(c => c.status === '❌ NOT DONE').length;
const cDeferred = carryovers.filter(c => c.status === '🔶 DEFERRED').length;
const cTotal = carryovers.length;

console.log('\n' + '═'.repeat(80));
console.log('📈 FINAL SUMMARY');
console.log('═'.repeat(80));

console.log(`\n  PUBLISH PLAN (40 Tasks):`);
console.log(`    ✅ Done:      ${done}/${total}`);
console.log(`    ⚠️  Partial:   ${partial}/${total}`);
console.log(`    ❌ Not Done:  ${notDone}/${total}`);
console.log(`    ℹ️  N/A:       ${na}/${total}`);
console.log(`    📊 Score:     ${Math.round((done / (total - na)) * 100)}%`);

console.log(`\n  P4 CARRYOVER (${cTotal} Items):`);
console.log(`    ✅ Done:      ${cDone}/${cTotal}`);
console.log(`    ⚠️  Partial:   ${cPartial}/${cTotal}`);
console.log(`    ❌ Not Done:  ${cNotDone}/${cTotal}`);
console.log(`    🔶 Deferred:  ${cDeferred}/${cTotal}`);
const cActionable = cTotal - cDeferred;
console.log(`    📊 Score:     ${cActionable > 0 ? Math.round((cDone / cActionable) * 100) : 0}% (excl deferred)`);

console.log(`\n  BLOCKING ITEMS:`);
const blockingNotDone = results.filter(r => r.priority.includes('BLOCK') && r.status !== '✅ DONE');
if (blockingNotDone.length === 0) {
  console.log(`    ✅ All blocking tasks resolved!`);
} else {
  for (const b of blockingNotDone) {
    console.log(`    ${b.status}  ${b.task} — ${b.detail}`);
  }
}

// Write machine-readable JSON
const outputPath = p('docs/publish-audit-results.json');
const output = {
  timestamp: new Date().toISOString(),
  publishPlan: { total, done, partial, notDone, na, score: Math.round((done / (total - na)) * 100) },
  carryover: { total: cTotal, done: cDone, partial: cPartial, notDone: cNotDone, deferred: cDeferred },
  tasks: results,
  carryoverItems: carryovers,
  blocking: blockingNotDone.map(b => ({ task: b.task, status: b.status, detail: b.detail })),
  testCount,
  tscErrors,
  version: pkg.version,
  published: isPublished
};

import { writeFileSync } from 'node:fs';
writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`\n  📄 Results written to: docs/publish-audit-results.json`);
console.log('═'.repeat(80));
