#!/usr/bin/env npx tsx
/**
 * context-budget.mts — Analyze workspace context size for token optimization
 *
 * Scans instruction files, AGENTS.md, copilot-instructions, and docs across
 * all registered repos. Reports total token estimates and identifies bloat.
 *
 * Usage:
 *   npx tsx scripts/context-budget.mts [--json] [--threshold N]
 *
 * Examples:
 *   npx tsx scripts/context-budget.mts                  # Default (show all)
 *   npx tsx scripts/context-budget.mts --threshold 500  # Flag files > 500 lines
 *   npx tsx scripts/context-budget.mts --json           # Machine-readable output
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ugwtfRoot = resolve(__dirname, '..');
const workspaceRoot = resolve(ugwtfRoot, '..');

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const thresholdIdx = args.indexOf('--threshold');
const lineThreshold = thresholdIdx >= 0 ? Number(args[thresholdIdx + 1]) : 300;

// ── Repos to scan ────────────────────────────────────────────────────────
const REPOS: Record<string, string> = {
  ugwtf:     ugwtfRoot,
  damieus:   resolve(workspaceRoot, 'damieus-com-migration'),
  ffs:       resolve(workspaceRoot, 'flipflops-sundays-reboot'),
  '043':     resolve(workspaceRoot, 'one4three-co-next-app'),
  maximus:   resolve(workspaceRoot, 'maximus-ai'),
  cae:       resolve(workspaceRoot, 'cae-luxury-hair'),
  management: resolve(workspaceRoot, 'Management'),
};

// ── Context file patterns ────────────────────────────────────────────────
const CONTEXT_PATTERNS = [
  '.github/copilot-instructions.md',
  '.github/instructions',  // directory
  'AGENTS.md',
  'CLAUDE.md',
];

interface FileMetric {
  repo: string;
  path: string;
  lines: number;
  bytes: number;
  estimatedTokens: number;
  category: 'instructions' | 'agents' | 'copilot' | 'claude' | 'docs';
}

interface RepoMetric {
  repo: string;
  files: FileMetric[];
  totalLines: number;
  totalBytes: number;
  totalTokens: number;
  bloatFiles: FileMetric[];  // files exceeding threshold
}

// ── Token estimator (rough: ~4 chars per token for markdown) ─────────────
function estimateTokens(bytes: number): number {
  return Math.ceil(bytes / 4);
}

function categorize(path: string): FileMetric['category'] {
  if (path.includes('instructions/') || path.includes('.instructions.md')) return 'instructions';
  if (path.includes('AGENTS.md')) return 'agents';
  if (path.includes('copilot-instructions')) return 'copilot';
  if (path.includes('CLAUDE.md')) return 'claude';
  return 'docs';
}

function scanDir(dir: string, repo: string): FileMetric[] {
  const metrics: FileMetric[] = [];
  if (!existsSync(dir)) return metrics;

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        metrics.push(...scanDir(fullPath, repo));
      } else if (entry.name.endsWith('.md')) {
        const stat = statSync(fullPath);
        const content = readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n').length;
        metrics.push({
          repo,
          path: relative(workspaceRoot, fullPath),
          lines,
          bytes: stat.size,
          estimatedTokens: estimateTokens(stat.size),
          category: categorize(fullPath),
        });
      }
    }
  } catch {
    // Permission errors, etc.
  }

  return metrics;
}

function scanRepo(alias: string, repoPath: string): RepoMetric {
  const files: FileMetric[] = [];

  for (const pattern of CONTEXT_PATTERNS) {
    const target = join(repoPath, pattern);
    if (!existsSync(target)) continue;

    const stat = statSync(target);
    if (stat.isDirectory()) {
      files.push(...scanDir(target, alias));
    } else {
      const content = readFileSync(target, 'utf-8');
      const lines = content.split('\n').length;
      files.push({
        repo: alias,
        path: relative(workspaceRoot, target),
        lines,
        bytes: stat.size,
        estimatedTokens: estimateTokens(stat.size),
        category: categorize(target),
      });
    }
  }

  const totalLines = files.reduce((s, f) => s + f.lines, 0);
  const totalBytes = files.reduce((s, f) => s + f.bytes, 0);
  const totalTokens = files.reduce((s, f) => s + f.estimatedTokens, 0);
  const bloatFiles = files.filter(f => f.lines > lineThreshold);

  return { repo: alias, files, totalLines, totalBytes, totalTokens, bloatFiles };
}

// ── Main ─────────────────────────────────────────────────────────────────
function main() {
  const repoMetrics: RepoMetric[] = [];

  for (const [alias, path] of Object.entries(REPOS)) {
    if (existsSync(path)) {
      repoMetrics.push(scanRepo(alias, path));
    }
  }

  // Sort by token count descending
  repoMetrics.sort((a, b) => b.totalTokens - a.totalTokens);

  if (jsonOutput) {
    const grandTotal = repoMetrics.reduce((s, r) => s + r.totalTokens, 0);
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      threshold: lineThreshold,
      grandTotalTokens: grandTotal,
      repos: repoMetrics,
    }, null, 2));
    return;
  }

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Context Budget Analyzer                        ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`Threshold: ${lineThreshold} lines | Repos: ${repoMetrics.length}\n`);

  let grandTotalTokens = 0;
  let totalBloat = 0;

  for (const repo of repoMetrics) {
    grandTotalTokens += repo.totalTokens;
    totalBloat += repo.bloatFiles.length;

    const tokenK = (repo.totalTokens / 1000).toFixed(1);
    console.log(`📦 ${repo.repo} — ${repo.files.length} files, ~${tokenK}K tokens`);

    // Group by category
    const cats = new Map<string, number>();
    for (const f of repo.files) {
      cats.set(f.category, (cats.get(f.category) ?? 0) + f.estimatedTokens);
    }
    for (const [cat, tokens] of Array.from(cats.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${cat}: ~${(tokens / 1000).toFixed(1)}K tokens`);
    }

    if (repo.bloatFiles.length > 0) {
      console.log(`  ⚠️  ${repo.bloatFiles.length} files exceed ${lineThreshold} lines:`);
      for (const f of repo.bloatFiles) {
        console.log(`    → ${f.path} (${f.lines} lines, ~${(f.estimatedTokens / 1000).toFixed(1)}K tokens)`);
      }
    }
    console.log();
  }

  console.log('═'.repeat(52));
  console.log(`Grand total: ~${(grandTotalTokens / 1000).toFixed(1)}K tokens across ${repoMetrics.length} repos`);
  if (totalBloat > 0) {
    console.log(`⚠️  ${totalBloat} files exceed ${lineThreshold} lines — consider splitting or converting to typed config`);
  }

  // Recommendations
  const heaviest = repoMetrics[0];
  if (heaviest && heaviest.totalTokens > 20000) {
    console.log(`\n💡 Heaviest repo: ${heaviest.repo} (~${(heaviest.totalTokens / 1000).toFixed(1)}K tokens)`);
    console.log('   Consider: convert large .md files to typed TS config, split bloated instruction files');
  }
}

main();
