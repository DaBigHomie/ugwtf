#!/usr/bin/env npx tsx
/**
 * UGWTF 30x Prompt Validation Script
 * ───────────────────────────────────
 * 12 criteria · 100-point weighted scoring · JSON report output
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
import { join, relative, basename, resolve } from 'node:path';

/* ───────── Types ───────── */

interface ParsedPrompt {
  filePath: string;
  fileName: string;
  title: string;
  priority: string | null;
  status: string | null;
  estimatedTime: string | null;
  agentType: string | null;
  revenueImpact: string | null;
  objective: string | null;
  hasSuccessCriteria: boolean;
  hasTestingChecklist: boolean;
  hasReferenceImpl: boolean;
  hasCodeExamples: boolean;
  hasFilesToModify: boolean;
  sections: string[];
  checklistItems: number;
  totalLines: number;
  depends: string[];
  raw: string;
}

interface CriterionResult {
  name: string;
  points: number;
  maxPoints: number;
  note: string;
}

interface ValidationResult {
  prompt: ParsedPrompt;
  score: number;
  maxScore: number;
  percent: number;
  criteria: CriterionResult[];
  passing: boolean;
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

/* ───────── Content Normalization ───────── */

/**
 * Strip ```prompt wrapper blocks that some repos use around prompt files.
 * Also strips YAML frontmatter (--- ... ---) blocks.
 */
function normalizeContent(raw: string): string {
  let content = raw;

  // Strip ```prompt ... ``` wrapper
  const promptBlockMatch = content.match(/^````?prompt\s*\n([\s\S]*?)````?\s*$/m);
  if (promptBlockMatch) {
    content = promptBlockMatch[1]!;
  }

  // Strip YAML frontmatter (--- ... ---)
  const frontmatterMatch = content.match(/^---\s*\n[\s\S]*?\n---\s*\n/);
  if (frontmatterMatch) {
    content = content.slice(frontmatterMatch[0].length);
  }

  return content;
}

/* ───────── Dependency Parser ───────── */

function parseDependencies(content: string): string[] {
  const depLineMatch = content.match(/\*\*Dependenc(?:ies|y)\*\*:\s*(.+)/i)
    ?? content.match(/\*\*Depends? On\*\*:\s*(.+)/i);

  if (!depLineMatch) return [];
  const depLine = depLineMatch[1]!.trim();

  if (/^none\b/i.test(depLine) || /can run in parallel/i.test(depLine)) return [];

  const deps: string[] = [];

  for (const m of depLine.matchAll(/#(\d+)/g)) {
    deps.push(`#${m[1]}`);
  }
  if (deps.length > 0) return deps;

  for (const m of depLine.matchAll(/([A-Z]+-\d+)/g)) {
    deps.push(m[1]!);
  }
  if (deps.length > 0) return deps;

  for (const m of depLine.matchAll(/(\d{2}-[a-z][a-z0-9-]+)/g)) {
    deps.push(m[1]!);
  }

  return deps;
}

/* ───────── Prompt Parser (Dual Format) ───────── */

/**
 * Parse a .prompt.md file. Supports two metadata formats:
 *
 * Format 1 — Inline:  **Priority**: P0
 * Format 2 — Table:   | **Priority** | P0 |
 *
 * Both formats extract the same fields into ParsedPrompt.
 */
function parsePrompt(raw: string, filePath: string): ParsedPrompt {
  const content = normalizeContent(raw);
  const lines = content.split('\n');

  // --- Title: first H1 ---
  const titleMatch = content.match(/^#\s+(?:PROMPT:\s*)?(.+)/m);

  // --- Metadata: try inline first, fall back to table ---
  const priority = extractField(content, 'Priority', /P\d/i);
  const status = extractField(content, 'Status', /[A-Z ]+/i);
  const estimatedTime = extractField(content, 'Estimated (?:Time|Hours)', /.+/i);
  const agentType = extractField(content, 'Agent Type', /.+/i);
  const revenueImpact = extractField(content, 'Revenue Impact', /.+/i);

  // --- Objective: ## Objective section, or ## Implementation Plan as fallback ---
  const objectiveMatch = content.match(/## Objective\s+(.+?)(?=\n---|\n##)/s)
    ?? content.match(/## Implementation Plan\s+(.+?)(?=\n---|\n##)/s);

  // --- Sections ---
  const sections = [...content.matchAll(/^## (.+)/gm)].map(m => m[1]!);
  const checklistItems = (content.match(/- \[[ x~]\]/g) ?? []).length;

  return {
    filePath,
    fileName: basename(filePath),
    title: titleMatch?.[1]?.replace(/\s*\(P\d\)\s*$/, '').trim() ?? basename(filePath, '.prompt.md'),
    priority,
    status: status?.replace(/\*+/g, '').trim() ?? null,
    estimatedTime,
    agentType,
    revenueImpact,
    objective: objectiveMatch?.[1]?.trim() ?? null,
    hasSuccessCriteria: /## Success Criteria/i.test(content) || /## Quality Gate/i.test(content),
    hasTestingChecklist: /## Testing Checklist/i.test(content) || /## Testing/i.test(content) || /## Quality Gate/i.test(content),
    hasReferenceImpl: /Reference Implementation/i.test(content) || /## Reference/i.test(content),
    hasCodeExamples: /```(?:typescript|tsx?|javascript|jsx?|sql|bash|sh|css|json)/i.test(content),
    hasFilesToModify: /## Files to (?:Modify|Create|Touch)/i.test(content) || /## File Changes/i.test(content),
    sections,
    checklistItems,
    totalLines: lines.length,
    depends: parseDependencies(content),
    raw: content,
  };
}

/**
 * Extract a metadata field from either inline or table format.
 *
 * Inline:  **Priority**: P0
 * Table:   | **Priority** | P0 |
 */
function extractField(content: string, fieldName: string, valuePattern: RegExp): string | null {
  // Try inline format first: **FieldName**: value
  const inlineMatch = content.match(new RegExp(`\\*\\*${fieldName}\\*\\*:\\s*(${valuePattern.source})`, 'i'));
  if (inlineMatch) return inlineMatch[1]!.trim();

  // Try table format: | **FieldName** | value |
  const tableMatch = content.match(new RegExp(`\\|\\s*\\*\\*${fieldName}\\*\\*\\s*\\|\\s*(${valuePattern.source})\\s*\\|`, 'i'));
  if (tableMatch) return tableMatch[1]!.trim();

  // Try table format without bold: | FieldName | value |
  const tablePlainMatch = content.match(new RegExp(`\\|\\s*${fieldName}\\s*\\|\\s*(${valuePattern.source})\\s*\\|`, 'i'));
  if (tablePlainMatch) return tablePlainMatch[1]!.trim();

  return null;
}

/* ───────── 12-Criterion Scoring ───────── */

function validatePrompt(p: ParsedPrompt, threshold: number): ValidationResult {
  const criteria: CriterionResult[] = [];

  // 1. Title clarity (10 pts) — becomes GitHub Issue title
  const titleScore = p.title.length > 5 && p.title.length < 120 ? 10 : (p.title.length > 0 ? 5 : 0);
  criteria.push({ name: 'Title', points: titleScore, maxPoints: 10,
    note: titleScore === 10 ? 'Clear, descriptive' : 'Too short or too long' });

  // 2. Priority assigned (10 pts) — controls chain ordering
  const priorityScore = p.priority ? 10 : 0;
  criteria.push({ name: 'Priority', points: priorityScore, maxPoints: 10,
    note: p.priority ?? 'Missing priority' });

  // 3. Objective / description (15 pts) — HIGHEST weight, what the agent reads first
  const objScore = p.objective && p.objective.length > 20 ? 15 : (p.objective ? 8 : 0);
  criteria.push({ name: 'Objective', points: objScore, maxPoints: 15,
    note: objScore === 15 ? 'Detailed objective' : (p.objective ? 'Objective too brief' : 'Missing objective') });

  // 4. Structured sections ≥ 4 (10 pts) — structured prompts reduce hallucination
  const sectionScore = p.sections.length >= 4 ? 10 : (p.sections.length >= 2 ? 6 : (p.sections.length >= 1 ? 3 : 0));
  criteria.push({ name: 'Sections', points: sectionScore, maxPoints: 10,
    note: `${p.sections.length} sections` });

  // 5. Success Criteria checkboxes (10 pts) — quality gates verify these
  const successScore = p.hasSuccessCriteria ? 10 : 0;
  criteria.push({ name: 'Success Criteria', points: successScore, maxPoints: 10,
    note: successScore ? 'Present' : 'Missing' });

  // 6. Testing Checklist (10 pts) — commands the agent runs before pushing
  const testScore = p.hasTestingChecklist ? 10 : 0;
  criteria.push({ name: 'Testing Checklist', points: testScore, maxPoints: 10,
    note: testScore ? 'Present' : 'Missing' });

  // 7. Code Examples (10 pts) — reduces ambiguity for the agent
  const codeScore = p.hasCodeExamples ? 10 : 0;
  criteria.push({ name: 'Code Examples', points: codeScore, maxPoints: 10,
    note: codeScore ? 'Present' : 'Missing' });

  // 8. Time Estimate (5 pts) — forecaster 30x readiness scoring
  const timeScore = p.estimatedTime ? 5 : 0;
  criteria.push({ name: 'Time Estimate', points: timeScore, maxPoints: 5,
    note: p.estimatedTime ?? 'Missing' });

  // 9. Revenue Impact (5 pts) — prioritization signal
  const revenueScore = p.revenueImpact ? 5 : 0;
  criteria.push({ name: 'Revenue Impact', points: revenueScore, maxPoints: 5,
    note: p.revenueImpact ?? 'Missing' });

  // 10. Checklist items ≥ 3 (5 pts) — granular acceptance criteria
  const checkScore = p.checklistItems >= 3 ? 5 : (p.checklistItems >= 1 ? 3 : 0);
  criteria.push({ name: 'Checklists', points: checkScore, maxPoints: 5,
    note: `${p.checklistItems} items` });

  // 11. Reference Implementation (5 pts) — points agent at working patterns
  const refScore = p.hasReferenceImpl ? 5 : 0;
  criteria.push({ name: 'Reference Impl', points: refScore, maxPoints: 5,
    note: refScore ? 'Present' : 'Missing' });

  // 12. Content depth ≥ 100 lines (5 pts) — deeper prompts = better results
  const depthScore = p.totalLines >= 100 ? 5 : (p.totalLines >= 50 ? 3 : 1);
  criteria.push({ name: 'Content Depth', points: depthScore, maxPoints: 5,
    note: `${p.totalLines} lines` });

  const totalPoints = criteria.reduce((sum, c) => sum + c.points, 0);
  const maxPoints = criteria.reduce((sum, c) => sum + c.maxPoints, 0);
  const percent = Math.round((totalPoints / maxPoints) * 1000) / 10; // one decimal

  return {
    prompt: p,
    score: totalPoints,
    maxScore: maxPoints,
    percent,
    criteria,
    passing: percent >= threshold,
  };
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
  console.log(`${DIM}12 criteria · 100-point scoring · gold-standard format${RESET}\n`);
}

function printResult(r: ValidationResult, verbose: boolean, cwdRoot: string): void {
  const icon = r.passing ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
  const scoreColor = r.passing ? GREEN : (r.percent >= 80 ? YELLOW : RED);
  const relPath = relative(cwdRoot, r.prompt.filePath);

  console.log(`  ${icon} ${DIM}${relPath}${RESET}  ${scoreColor}${r.percent}%${RESET} (${r.score}/${r.maxScore})`);

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
    ? Math.round(results.reduce((s, r) => s + r.percent, 0) / results.length * 10) / 10
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
      ? Math.round(results.reduce((s, r) => s + r.percent, 0) / results.length * 10) / 10
      : 0,
    threshold,
    results: results.map(r => ({
      file: relative(cwdRoot, r.prompt.filePath),
      score: r.score,
      percent: r.percent,
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
    const parsed = parsePrompt(raw, filePath);
    const result = validatePrompt(parsed, threshold);
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
