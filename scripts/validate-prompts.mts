#!/usr/bin/env npx tsx
/**
 * UGWTF 30x Prompt Validation Script
 * ───────────────────────────────────
 * 18 criteria · 125-point weighted scoring · JSON report output
 * Validates .prompt.md files against the gold-standard format.
 *
 * Usage:
 *   npx tsx scripts/validate-prompts.mts --cwd <path> [--json] [--verbose] [--threshold <n>]
 *
 * Examples:
 *   npx tsx scripts/validate-prompts.mts --cwd ~/management-git/one4three-co-next-app
 *   npx tsx scripts/validate-prompts.mts --cwd ./docs/prompts --verbose
 *   npx tsx scripts/validate-prompts.mts --cwd ~/repos/myapp --json --threshold 90
 */

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  type ParsedPrompt,
  type CriterionResult,
  type ValidationResult as BaseValidationResult,
  normalizeContent,
  parseFormatB,
  validatePrompt as scorePrompt,
} from '../src/prompt/index.js';

/* ───────── Script-specific types ───────── */

interface ValidationResult extends BaseValidationResult {
  passing: boolean;
  percentDecimal: number;
}

interface ReportSummary {
  totalPrompts: number;
  passing: number;
  failing: number;
  averageScore: number;
  threshold: number;
  results: Array<{
    file: string;
    score: number;
    percent: number;
    passing: boolean;
    criteria: CriterionResult[];
  }>;
}

/* ───────── CLI Flags ───────── */

function parseArgs(): { cwd: string; json: boolean; verbose: boolean; threshold: number } {
  const args = process.argv.slice(2);
  let cwd = process.cwd();
  let json = false;
  let verbose = false;
  let threshold = 99.9;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--cwd' && args[i + 1]) { cwd = resolve(args[++i]!); }
    else if (arg === '--json') { json = true; }
    else if (arg === '--verbose') { verbose = true; }
    else if (arg === '--threshold' && args[i + 1]) { threshold = parseFloat(args[++i]!); }
    else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npx tsx scripts/validate-prompts.mts --cwd <path> [flags]

Flags:
  --cwd <path>       Root directory to scan for .prompt.md files (required)
  --json             Output JSON report to reports/prompt-validation.json
  --verbose          Show per-criterion breakdown for each prompt
  --threshold <n>    Minimum passing score percentage (default: 99.9)
  -h, --help         Show this help message
`);
      process.exit(0);
    }
  }

  return { cwd, json, verbose, threshold };
}

/* ───────── File Discovery ───────── */

function walk(dir: string): string[] {
  const skip = new Set(['node_modules', '.next', 'dist', '.git', 'reports', '.turbo']);
  const out: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      if (skip.has(entry)) continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        out.push(...walk(full));
      } else if (full.endsWith('.prompt.md')) {
        out.push(full);
      }
    }
  } catch {
    // Directory not readable
  }
  return out;
}

/* ───────── Validate wrapper — adds threshold + decimal precision ───────── */

function validateForScript(p: ParsedPrompt, threshold: number): ValidationResult {
  const base = scorePrompt(p);
  const percentDecimal = Math.round((base.score / base.maxScore) * 1000) / 10;
  return { ...base, passing: percentDecimal >= threshold, percentDecimal };
}

/* ───────── Terminal Output ───────── */

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function printHeader(): void {
  console.log(`\n${BOLD}${CYAN}UGWTF 30x Prompt Validator${RESET}`);
  console.log(`${DIM}18 criteria · 125-point scoring · gold-standard format${RESET}\n`);
}

function printResult(r: ValidationResult, verbose: boolean, cwdRoot: string): void {
  const icon = r.passing ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
  const scoreColor = r.passing ? GREEN : (r.percentDecimal >= 80 ? YELLOW : RED);
  const relPath = relative(cwdRoot, r.prompt.filePath);

  console.log(`  ${icon} ${DIM}${relPath}${RESET}  ${scoreColor}${r.percentDecimal}%${RESET} (${r.score}/${r.maxScore})`);

  if (verbose) {
    for (const c of r.criteria) {
      const cIcon = c.points === c.maxPoints ? `${GREEN}✓${RESET}` : (c.points > 0 ? `${YELLOW}~${RESET}` : `${RED}✗${RESET}`);
      console.log(`      ${cIcon} ${c.name}: ${c.points}/${c.maxPoints} — ${DIM}${c.note}${RESET}`);
    }
    console.log('');
  }
}

function printSummary(results: ValidationResult[], threshold: number): void {
  const passing = results.filter(r => r.passing).length;
  const failing = results.length - passing;
  const avgScore = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.percentDecimal, 0) / results.length * 10) / 10
    : 0;

  console.log(`\n${BOLD}Summary${RESET}`);
  console.log(`  Total:     ${results.length}`);
  console.log(`  Passing:   ${GREEN}${passing}${RESET}`);
  if (failing > 0) console.log(`  Failing:   ${RED}${failing}${RESET}`);
  console.log(`  Average:   ${avgScore >= threshold ? GREEN : (avgScore >= 80 ? YELLOW : RED)}${avgScore}%${RESET}`);
  console.log(`  Threshold: ${threshold}%`);

  if (failing > 0) {
    console.log(`\n${RED}${BOLD}FAIL${RESET} — ${failing} prompt(s) below ${threshold}% threshold`);
  } else if (results.length > 0) {
    console.log(`\n${GREEN}${BOLD}PASS${RESET} — All prompts meet ${threshold}% threshold`);
  } else {
    console.log(`\n${YELLOW}${BOLD}WARN${RESET} — No .prompt.md files found`);
  }
  console.log('');
}

/* ───────── JSON Report ───────── */

function writeReport(results: ValidationResult[], threshold: number, cwdRoot: string): void {
  const reportDir = join(process.cwd(), 'reports');
  if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });

  const summary: ReportSummary = {
    totalPrompts: results.length,
    passing: results.filter(r => r.passing).length,
    failing: results.filter(r => !r.passing).length,
    averageScore: results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.percentDecimal, 0) / results.length * 10) / 10
      : 0,
    threshold,
    results: results.map(r => ({
      file: relative(cwdRoot, r.prompt.filePath),
      score: r.score,
      percent: r.percentDecimal,
      passing: r.passing,
      criteria: r.criteria,
    })),
  };

  const outPath = join(reportDir, 'prompt-validation.json');
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`${DIM}Report written to ${relative(process.cwd(), outPath)}${RESET}`);
}

/* ───────── Main ───────── */

function main(): void {
  const { cwd, json, verbose, threshold } = parseArgs();

  printHeader();
  console.log(`${DIM}Scanning: ${cwd}${RESET}`);
  console.log(`${DIM}Threshold: ${threshold}%${RESET}\n`);

  // Discover prompt files
  const files = walk(cwd);
  if (files.length === 0) {
    console.log(`${YELLOW}No .prompt.md files found in ${cwd}${RESET}\n`);
    process.exit(0);
  }

  console.log(`${DIM}Found ${files.length} prompt file(s)${RESET}\n`);

  // Parse and validate
  const results: ValidationResult[] = [];
  for (const filePath of files.sort()) {
    const raw = readFileSync(filePath, 'utf-8');
    const content = normalizeContent(raw);
    const parsed = parseFormatB(content, filePath);
    const result = validateForScript(parsed, threshold);
    results.push(result);
    printResult(result, verbose, cwd);
  }

  printSummary(results, threshold);

  if (json) {
    writeReport(results, threshold, cwd);
  }

  // Exit code: 1 if any prompt fails threshold
  const failing = results.filter(r => !r.passing).length;
  process.exit(failing > 0 ? 1 : 0);
}

main();
