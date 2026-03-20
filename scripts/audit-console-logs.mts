/**
 * audit-console-logs.mts
 * Scans src/ for console.log statements outside test/mock files.
 * Reports file:line for each occurrence.
 *
 * Run: npx tsx scripts/audit-console-logs.mts
 *
 * Note: Auto-fix is intentionally not implemented — scaffold/ and generators/
 * console.logs are intentional CLI user output and require manual judgment.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

interface Hit { file: string; line: number; text: string }
const hits: Hit[] = [];

function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__mocks__' || entry === 'node_modules') continue;
      walk(full);
    } else if (full.endsWith('.ts') && !full.endsWith('.test.ts')) {
      const lines = readFileSync(full, 'utf-8').split('\n');
      lines.forEach((text, i) => {
        if (/console\.log\(/.test(text) && !/\/\/.*console\.log/.test(text)) {
          hits.push({ file: relative(ROOT, full), line: i + 1, text: text.trim() });
        }
      });
    }
  }
}

walk(SRC);

if (hits.length === 0) {
  console.log('✅ No stray console.log found in production source.');
  process.exit(0);
}

// Group by directory for clarity
const byDir: Record<string, Hit[]> = {};
for (const h of hits) {
  const dir = h.file.split('/').slice(0, 2).join('/');
  (byDir[dir] ??= []).push(h);
}

console.log(`Found ${hits.length} console.log statements in src/ (excluding test files):\n`);
for (const [dir, dirHits] of Object.entries(byDir)) {
  console.log(`  📂 ${dir}  (${dirHits.length} hits)`);
  for (const h of dirHits) {
    console.log(`    ${h.file}:${h.line}  ${h.text.slice(0, 80)}`);
  }
}

console.log(`
ℹ️  scaffold/ and generators/ logs are typically intentional CLI output — keep those.
   Logs in agents/, swarm/, clients/, orchestrator.ts are likely stray debug logs — review and replace with ctx.logger.
`);
