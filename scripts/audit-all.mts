#!/usr/bin/env npx tsx
/**
 * audit-all.mts — Run UGWTF audit across all registered repos
 *
 * Usage:
 *   npx tsx scripts/audit-all.mts [--dry-run] [--verbose]
 *
 * Equivalent to:
 *   npx tsx src/index.ts audit --verbose
 *
 * But adds summary formatting and cross-repo comparison.
 */
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ugwtfRoot = resolve(__dirname, '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');

const repos = ['043', 'damieus', 'ffs', 'maximus', 'cae'];

interface AuditResult {
  repo: string;
  success: boolean;
  output: string;
}

console.log('╔══════════════════════════════════════════╗');
console.log('║   UGWTF Cross-Repo Audit                ║');
console.log('╚══════════════════════════════════════════╝');
console.log(`Repos: ${repos.join(', ')}`);
console.log(`Dry run: ${dryRun}\n`);

const results: AuditResult[] = [];

for (const repo of repos) {
  console.log(`\n━━━ Auditing: ${repo} ━━━`);
  try {
    const flags = [verbose ? '--verbose' : '', dryRun ? '--dry-run' : ''].filter(Boolean).join(' ');
    const output = execSync(
      `npx tsx src/index.ts audit ${repo} ${flags}`,
      {
        cwd: ugwtfRoot,
        encoding: 'utf-8',
        timeout: 120000,
        env: { ...process.env },
      }
    );
    results.push({ repo, success: true, output });
    console.log(output);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    results.push({ repo, success: false, output: errMsg });
    console.error(`  ❌ Audit failed for ${repo}: ${errMsg}`);
  }
}

// Summary
console.log('\n╔══════════════════════════════════════════╗');
console.log('║   Audit Summary                          ║');
console.log('╚══════════════════════════════════════════╝');
for (const r of results) {
  const icon = r.success ? '✅' : '❌';
  console.log(`  ${icon} ${r.repo}`);
}

const passed = results.filter(r => r.success).length;
console.log(`\n${passed}/${results.length} repos audited successfully.`);
