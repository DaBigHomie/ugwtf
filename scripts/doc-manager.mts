#!/usr/bin/env npx tsx
/**
 * doc-manager.mts — Audit and manage documentation files
 *
 * Commands:
 *   audit    Show all .md files with line counts and classification
 *   archive  Move historical docs to docs/archive/
 *   stats    Show token-efficiency stats
 *
 * Usage:
 *   npx tsx scripts/doc-manager.mts audit
 *   npx tsx scripts/doc-manager.mts archive --dry-run
 */
import { readdirSync, statSync, mkdirSync, renameSync, readFileSync } from 'node:fs';
import { resolve, relative, basename } from 'node:path';

const ROOT = resolve(import.meta.dirname ?? '.', '..');
const ARCHIVE_DIR = resolve(ROOT, 'docs', 'archive');

interface DocFile {
  path: string;
  relativePath: string;
  lines: number;
  category: 'keep' | 'archive' | 'instructions';
  reason: string;
}

// Files that should be archived (historical planning docs)
const ARCHIVE_PATTERNS = [
  '30X-PIPELINE-HARDENING-PLAN.md',
  'PROMPT-CHAIN-SYSTEM.md',
  'AUDIT-CHAIN-SYSTEM-GUIDE.md',
  'PHASE-CHECKLIST.md',
  'FORECAST-AUDIT.md',
];

// Files that are already in the correct format
const KEEP_PATTERNS = [
  'README.md',
  '40X-GAP-ANALYSIS-CHECKLIST.md',
  'AUDIT-ORCHESTRATOR-CHANGELOG.md',
];

function findMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' || entry.name === 'archive') {
      continue;
    }
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(fullPath));
    } else if (entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

function countLines(filePath: string): number {
  return readFileSync(filePath, 'utf-8').split('\n').length;
}

function classifyFile(filePath: string): DocFile {
  const name = basename(filePath);
  const relativePath = relative(ROOT, filePath);
  const lines = countLines(filePath);

  if (filePath.endsWith('.instructions.md')) {
    return { path: filePath, relativePath, lines, category: 'instructions', reason: 'Agent-scoped instruction file' };
  }

  if (ARCHIVE_PATTERNS.includes(name)) {
    return { path: filePath, relativePath, lines, category: 'archive', reason: 'Historical planning doc — no longer active' };
  }

  return { path: filePath, relativePath, lines, category: 'keep', reason: lines < 200 ? 'Small enough' : 'Active reference' };
}

function auditDocs(): void {
  const files = findMarkdownFiles(ROOT).map(classifyFile);
  const totalLines = files.reduce((sum, f) => sum + f.lines, 0);

  console.log('\n📊 Documentation Audit\n');
  console.log(`${'File'.padEnd(50)} ${'Lines'.padStart(6)} ${'Category'.padEnd(14)} Reason`);
  console.log('─'.repeat(100));

  const sorted = files.sort((a, b) => b.lines - a.lines);
  for (const f of sorted) {
    const icon = f.category === 'archive' ? '📦' : f.category === 'instructions' ? '🎯' : '✅';
    console.log(`${icon} ${f.relativePath.padEnd(48)} ${String(f.lines).padStart(6)} ${f.category.padEnd(14)} ${f.reason}`);
  }

  console.log('─'.repeat(100));
  console.log(`Total: ${files.length} files, ${totalLines} lines`);

  const archiveLines = files.filter(f => f.category === 'archive').reduce((s, f) => s + f.lines, 0);
  const instrLines = files.filter(f => f.category === 'instructions').reduce((s, f) => s + f.lines, 0);
  console.log(`\n  Archive candidates: ${archiveLines} lines (${((archiveLines / totalLines) * 100).toFixed(0)}% of total)`);
  console.log(`  Agent-scoped .instructions.md: ${instrLines} lines (always loaded contextually)`);
  console.log(`  Active docs: ${totalLines - archiveLines} lines remaining after archive\n`);
}

function archiveDocs(dryRun: boolean): void {
  const files = findMarkdownFiles(ROOT).map(classifyFile).filter(f => f.category === 'archive');

  if (files.length === 0) {
    console.log('No files to archive.');
    return;
  }

  if (!dryRun) {
    mkdirSync(ARCHIVE_DIR, { recursive: true });
  }

  console.log(`\n📦 Archiving ${files.length} historical docs${dryRun ? ' (dry-run)' : ''}:\n`);

  for (const f of files) {
    const dest = resolve(ARCHIVE_DIR, basename(f.path));
    console.log(`  ${f.relativePath} (${f.lines} lines) → docs/archive/${basename(f.path)}`);
    if (!dryRun) {
      renameSync(f.path, dest);
    }
  }

  const totalLines = files.reduce((s, f) => s + f.lines, 0);
  console.log(`\n${dryRun ? 'Would archive' : 'Archived'}: ${totalLines} lines across ${files.length} files\n`);
}

// CLI
const command = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

switch (command) {
  case 'audit':
    auditDocs();
    break;
  case 'archive':
    archiveDocs(dryRun);
    break;
  case 'stats':
    auditDocs();
    break;
  default:
    console.log(`
  doc-manager — Audit and manage UGWTF documentation

  Commands:
    audit      Show all .md files with classification
    archive    Move historical docs to docs/archive/
    stats      Show token-efficiency stats

  Options:
    --dry-run  Preview changes without executing

  Usage:
    npx tsx scripts/doc-manager.mts audit
    npx tsx scripts/doc-manager.mts archive --dry-run
`);
}
