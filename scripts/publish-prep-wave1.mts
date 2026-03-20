#!/usr/bin/env npx tsx
/**
 * publish-prep-wave1.mts
 * Automates: tsconfig fix, dist rebuild, LICENSE creation, CHANGELOG creation,
 * .npmignore creation, npm pkg fix, and dry-run verification.
 *
 * Run: npx tsx scripts/publish-prep-wave1.mts
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

function step(label: string, fn: () => void) {
  process.stdout.write(`⏳ ${label}...`);
  fn();
  console.log(` ✅`);
}

// --- Task 1: Fix tsconfig.json exclude ---
step('Fix tsconfig.json exclude', () => {
  const tscPath = join(ROOT, 'tsconfig.json');
  const tsconfig = JSON.parse(readFileSync(tscPath, 'utf-8'));
  tsconfig.exclude = ['node_modules', 'dist', 'src/**/*.test.ts', 'src/__mocks__'];
  writeFileSync(tscPath, JSON.stringify(tsconfig, null, 2) + '\n');
});

// --- Task 4: Create LICENSE ---
step('Create LICENSE (MIT)', () => {
  const licensePath = join(ROOT, 'LICENSE');
  if (!existsSync(licensePath)) {
    const year = new Date().getFullYear();
    writeFileSync(licensePath, `MIT License

Copyright (c) ${year} DaBigHomie

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`);
  } else {
    console.log(' (already exists, skipping)');
  }
});

// --- Task 11: Create CHANGELOG.md ---
step('Create CHANGELOG.md', () => {
  const clPath = join(ROOT, 'CHANGELOG.md');
  if (!existsSync(clPath)) {
    writeFileSync(clPath, `# Changelog

All notable changes to \`@dabighomie/ugwtf\` will be documented in this file.

## [1.0.0] - ${new Date().toISOString().slice(0, 10)}

### Added
- 86 agents across 35 clusters
- 23 CLI commands (deploy, validate, fix, labels, issues, prs, audit, scan, etc.)
- 6 registered repos (damieus, 043, ffs, cae, maximus, ugwtf)
- 7 YAML generators for CI/CD workflows
- 383 tests across 20 test files
- Plugin system with @dabighomie/audit-orchestrator
- Swarm executor with topological cluster ordering
- Copilot assignment fixes: dual transport, rate limiting, verification, PR quality gate
- Gold-standard 12-point scoring for prompt validation
- Chain pipeline: generate-chain → chain → issue creation → Copilot advancement
`);
  } else {
    console.log(' (already exists, skipping)');
  }
});

// --- Task 12: Create .npmignore ---
step('Create .npmignore', () => {
  const npmignorePath = join(ROOT, '.npmignore');
  if (!existsSync(npmignorePath)) {
    writeFileSync(npmignorePath, `src/
docs/
scripts/
packages/
tests/
*.test.ts
__mocks__/
.github/
.env*
vitest.config.ts
tsconfig.json
AGENTS.md
CLAUDE.md
SCOREBOARD.json
*.prompt.md
reports/
projects/
`);
  } else {
    console.log(' (already exists, skipping)');
  }
});

// --- Task 2: Rebuild dist ---
step('Rebuild dist', () => {
  execSync('npm run build', { cwd: ROOT, stdio: 'pipe' });
});

// --- Verify: 0 test files in dist ---
step('Verify no test files in dist', () => {
  const testFiles = execSync('find dist -name "*.test.*" 2>/dev/null || true', {
    cwd: ROOT, encoding: 'utf-8',
  }).trim();
  const mockDirs = execSync('find dist -name "__mocks__" 2>/dev/null || true', {
    cwd: ROOT, encoding: 'utf-8',
  }).trim();
  if (testFiles || mockDirs) {
    console.error(`\n❌ Found test artifacts in dist/:\n${testFiles}\n${mockDirs}`);
    process.exit(1);
  }
});

// --- Task 15: npm pkg fix ---
step('Run npm pkg fix', () => {
  execSync('npm pkg fix', { cwd: ROOT, stdio: 'pipe' });
});

// --- Verify: tests still pass ---
step('Verify tests pass', () => {
  execSync('npx vitest run', { cwd: ROOT, stdio: 'pipe' });
});

// --- Verify: tsc ---
step('Verify tsc --noEmit', () => {
  execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe' });
});

// --- Dry run ---
console.log('\n📦 npm publish --dry-run:\n');
execSync('npm publish --dry-run', { cwd: ROOT, stdio: 'inherit' });

console.log('\n✅ Wave 1 prep complete. Review output above, then commit.');
