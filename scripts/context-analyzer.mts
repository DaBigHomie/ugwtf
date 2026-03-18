#!/usr/bin/env npx tsx
/**
 * context-analyzer.mts — Analyze codebase context for optimal token budgeting
 *
 * Swarm automation script that:
 * 1. Maps the ugwtf codebase structure (src/, scripts/, docs/)
 * 2. Calculates file sizes and complexity metrics
 * 3. Ranks files by importance for context loading
 * 4. Produces a prioritized context manifest for agents
 *
 * Helps agents decide WHICH files to read first, reducing wasted tokens.
 *
 * Usage:
 *   npx tsx scripts/context-analyzer.mts                  # Full analysis
 *   npx tsx scripts/context-analyzer.mts --top 10         # Top 10 files
 *   npx tsx scripts/context-analyzer.mts --cluster quality # Files for a cluster
 *   npx tsx scripts/context-analyzer.mts --json           # JSON output
 */
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ugwtfRoot = resolve(__dirname, '..');

// ── CLI parsing ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const topN = args.includes('--top') ? parseInt(args[args.indexOf('--top') + 1] || '20', 10) : 20;
const clusterFilter = args.includes('--cluster') ? args[args.indexOf('--cluster') + 1] : null;

// ── Types ────────────────────────────────────────────────────────────────
interface FileEntry {
  path: string;
  relativePath: string;
  sizeBytes: number;
  lines: number;
  exports: number;
  imports: number;
  isTest: boolean;
  isType: boolean;
  priority: number;
  cluster?: string;
}

// ── File Discovery ───────────────────────────────────────────────────────
function walkDir(dir: string, ext: string[]): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.ugwtf') continue;
      if (entry.isDirectory()) {
        results.push(...walkDir(full, ext));
      } else if (ext.includes(extname(entry.name))) {
        results.push(full);
      }
    }
  } catch { /* skip */ }
  return results;
}

// ── Cluster tagging ──────────────────────────────────────────────────────
const CLUSTER_PATTERNS: Record<string, RegExp> = {
  'clusters': /clusters?\//,
  'output': /output\//,
  'swarm': /swarm\//,
  'orchestrator': /orchestrator/,
  'cli': /cli\//,
  'config': /config\//,
  'utils': /utils?\//,
  'types': /types\.ts/,
  'integration': /integration\.test/,
  'scripts': /scripts\//,
  'docs': /docs\//,
};

function tagCluster(relPath: string): string | undefined {
  for (const [cluster, pattern] of Object.entries(CLUSTER_PATTERNS)) {
    if (pattern.test(relPath)) return cluster;
  }
  return undefined;
}

// ── Analysis ─────────────────────────────────────────────────────────────
function analyzeFile(filePath: string): FileEntry {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relPath = relative(ugwtfRoot, filePath);

  const exportCount = (content.match(/\bexport\b/g) || []).length;
  const importCount = (content.match(/\bimport\b/g) || []).length;
  const isTest = relPath.includes('.test.') || relPath.includes('.spec.');
  const isType = relPath.includes('types') || /^(interface|type|enum)\s/.test(content);

  // Priority: types > core source > tests > docs > scripts
  let priority = 50;
  if (isType) priority = 90;
  else if (relPath.startsWith('src/') && !isTest) priority = 80;
  else if (isTest) priority = 40;
  else if (relPath.startsWith('scripts/')) priority = 30;
  else if (relPath.startsWith('docs/')) priority = 20;

  // Boost for high export count (API surface)
  priority += Math.min(exportCount * 2, 10);
  // Boost for entry points
  if (relPath.includes('index.')) priority += 5;

  return {
    path: filePath,
    relativePath: relPath,
    sizeBytes: statSync(filePath).size,
    lines: lines.length,
    exports: exportCount,
    imports: importCount,
    isTest,
    isType,
    priority: Math.min(priority, 100),
    cluster: tagCluster(relPath),
  };
}

// ── Execution ────────────────────────────────────────────────────────────
const files = walkDir(ugwtfRoot, ['.ts', '.mts', '.md']);
const entries = files.map(analyzeFile);

// Apply cluster filter
let filtered = clusterFilter
  ? entries.filter(e => e.cluster === clusterFilter)
  : entries;

// Sort by priority desc
filtered.sort((a, b) => b.priority - a.priority);

// Limit to top N
const topEntries = filtered.slice(0, topN);

// ── Stats ────────────────────────────────────────────────────────────────
const totalLines = entries.reduce((s, e) => s + e.lines, 0);
const totalBytes = entries.reduce((s, e) => s + e.sizeBytes, 0);
const testFiles = entries.filter(e => e.isTest).length;
const srcFiles = entries.filter(e => !e.isTest && e.relativePath.startsWith('src/')).length;

const result = {
  totalFiles: entries.length,
  totalLines,
  totalBytes,
  srcFiles,
  testFiles,
  topEntries: topEntries.map(e => ({
    relativePath: e.relativePath,
    lines: e.lines,
    priority: e.priority,
    cluster: e.cluster,
    exports: e.exports,
  })),
  clusterBreakdown: Object.entries(
    entries.reduce<Record<string, number>>((acc, e) => {
      const key = e.cluster || 'uncategorized';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]),
  timestamp: new Date().toISOString(),
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   UGWTF Context Analyzer                 ║');
  console.log('╚══════════════════════════════════════════╝\n');

  console.log(`  📁 Files: ${result.totalFiles} | Lines: ${totalLines.toLocaleString()} | Size: ${(totalBytes / 1024).toFixed(0)} KB`);
  console.log(`  📦 Source: ${srcFiles} | Tests: ${testFiles} | Scripts: ${entries.filter(e => e.relativePath.startsWith('scripts/')).length}`);
  if (clusterFilter) console.log(`  🔍 Filtered to cluster: ${clusterFilter}`);
  console.log('');

  console.log('  ── Top Files (context priority) ──────────');
  for (const e of topEntries) {
    const tag = e.cluster ? ` [${e.cluster}]` : '';
    console.log(`  ${String(e.priority).padStart(3)}  ${e.relativePath} (${e.lines} lines)${tag}`);
  }

  console.log('\n  ── Cluster Breakdown ──────────────────────');
  for (const [cluster, count] of result.clusterBreakdown) {
    console.log(`  ${String(count).padStart(4)} files  ${cluster}`);
  }
  console.log('');
}

// Write report
const reportDir = join(ugwtfRoot, '.ugwtf', 'reports');
mkdirSync(reportDir, { recursive: true });
writeFileSync(
  join(reportDir, `context-analysis-${Date.now()}.json`),
  JSON.stringify(result, null, 2),
);

if (!jsonOutput) console.log(`  📝 Report saved to .ugwtf/reports/\n`);
