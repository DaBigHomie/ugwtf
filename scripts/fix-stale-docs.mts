#!/usr/bin/env npx tsx
/**
 * fix-stale-docs.mts
 * Automates: README.md test/agent counts, copilot-instructions.md counts,
 * 00-QUICK-START.md count, README license section, AUDIT-RESULTS.json paths.
 *
 * Run: npx tsx scripts/fix-stale-docs.mts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
let fixes = 0;

function fixFile(relPath: string, replacements: [RegExp | string, string][]) {
  const absPath = join(ROOT, relPath);
  let content = readFileSync(absPath, 'utf-8');
  const before = content;
  for (const [find, replace] of replacements) {
    content = typeof find === 'string'
      ? content.replaceAll(find, replace)
      : content.replace(find, replace);
  }
  const changed = content !== before;
  if (changed) {
    fixes += replacements.length; // approximate; exact count not critical
    writeFileSync(absPath, content);
  }
  console.log(`  ${changed ? '✅' : '⏭️ (no change)'} ${relPath}`);
}

console.log('Fixing stale documentation...\n');

// Task 6+7+5: README.md — test count + agent count + license
fixFile('README.md', [
  [/~?85 agents/g, '86 agents'],
  [/34 clusters/g, '35 clusters'],
  [/~?85 agent implementations/g, '86 agent implementations'],
  [/\*\*156 tests\*\*/g, '**383 tests**'],
  [/156 tests.*across.*test files[^\n]*/g, '**383 tests** across 20 test files'],
  ['Private — DaBigHomie', 'MIT — see [LICENSE](LICENSE) for details.'],
]);

// Task 8: copilot-instructions.md (two occurrences)
fixFile('.github/copilot-instructions.md', [
  [/261\+ tests/g, '383 tests'],
  [/15 files/g, '20 files'],
]);

// Task 9: 00-QUICK-START.md
fixFile('docs/agent-guide/00-QUICK-START.md', [
  [/261 tests pass/g, '383 tests pass'],
  [/261\+ tests/g, '383 tests'],
]);

// Task 10: AUDIT-RESULTS.json — strip hardcoded absolute paths
fixFile('docs/AUDIT-RESULTS.json', [
  [/\/Users\/dame\/management-git\/ugwtf\//g, ''],
  [/\/home\/[^/]+\/work\/ugwtf\/ugwtf\//g, ''],
  [/"cwd":\s*"\/[^"]*"/g, '"cwd": "."'],
]);

console.log(`\n✅ Done — ${fixes} replacement groups applied.`);
