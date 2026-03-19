/**
 * Prompt Scanner, Validator & Forecaster Agents
 *
 * Scans repos for .prompt.md files, validates them against gold standards,
 * creates GitHub Issues from actionable prompts, and generates 30x forecasts.
 *
 * Supports two prompt formats:
 *   Format A: .github/prompts/ — YAML frontmatter with description & agent fields
 *   Format B: docs/agent-prompts/ — Markdown headers with P0-P8 priority system
 */
import type { Agent, AgentResult, AgentContext, GitHubIssue } from '../types.js';
import { getRepo } from '../config/repo-registry.js';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';

// ---------------------------------------------------------------------------
// Prompt data model
// ---------------------------------------------------------------------------

export interface ParsedPrompt {
  filePath: string;
  fileName: string;
  format: 'A' | 'B';
  title: string;
  priority: string | null;     // P0-P8 or null
  status: string | null;       // COMPLETE, READY TO START, IN PROGRESS, etc.
  estimatedTime: string | null;
  agentType: string | null;
  revenueImpact: string | null;
  objective: string | null;
  hasSuccessCriteria: boolean;
  hasTestingChecklist: boolean;
  hasDatabaseSchema: boolean;
  hasReferenceImpl: boolean;
  hasCodeExamples: boolean;
  sections: string[];
  checklistItems: number;
  totalLines: number;
  depends: string[];            // dependency references parsed from prompt body
  raw: string;
}

// ---------------------------------------------------------------------------
// Dependency parser
// ---------------------------------------------------------------------------

/**
 * Parse dependency declarations from prompt markdown body.
 * Supports:
 *   - "**Dependencies**: Gaps #20 must be completed first." → ['#20']
 *   - "**Dependencies**: Gaps #7, #8" → ['#7', '#8']
 *   - "**Dependencies**: None" or "can run in parallel" → []
 *   - "**Depends On**: FI-01, FI-03" → ['FI-01', 'FI-03']
 *   - "**Dependencies**: 01-supabase-client-setup" → ['01-supabase-client-setup']
 */
export function parseDependencies(content: string): string[] {
  // Match lines like **Dependencies**: ... or **Depends On**: ...
  const depLineMatch = content.match(/\*\*Dependenc(?:ies|y)\*\*:\s*(.+)/i)
    ?? content.match(/\*\*Depends? On\*\*:\s*(.+)/i);

  if (!depLineMatch) return [];
  const depLine = depLineMatch[1]!.trim();

  // "None" or "can run in parallel" → no deps
  if (/^none\b/i.test(depLine) || /can run in parallel/i.test(depLine)) return [];

  const deps: string[] = [];

  // Pattern: Gaps #N → extract all #N
  for (const m of depLine.matchAll(/#(\d+)/g)) {
    deps.push(`#${m[1]}`);
  }
  if (deps.length > 0) return deps;

  // Pattern: FI-01, FI-03 style prompt IDs
  for (const m of depLine.matchAll(/([A-Z]+-\d+)/g)) {
    deps.push(m[1]!);
  }
  if (deps.length > 0) return deps;

  // Pattern: filename references (01-supabase-client-setup)
  for (const m of depLine.matchAll(/(\d{2}-[a-z][a-z0-9-]+)/g)) {
    deps.push(m[1]!);
  }

  return deps;
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function parseFormatB(content: string, filePath: string): ParsedPrompt {
  const lines = content.split('\n');
  const titleMatch = content.match(/^#\s+(?:PROMPT:\s*)?(.+)/m);
  const priorityMatch = content.match(/\*\*Priority\*\*:\s*(P\d)/i);
  const statusMatch = content.match(/\*\*Status\*\*:\s*(?:🔄|✅|⏳|❌)?\s*\*?\*?([A-Z ]+)\*?\*?/i);
  const timeMatch = content.match(/\*\*Estimated Time\*\*:\s*(.+)/i);
  const agentMatch = content.match(/\*\*Agent Type\*\*:\s*(.+)/i);
  const revenueMatch = content.match(/\*\*Revenue Impact\*\*:\s*(.+)/i);
  const objectiveMatch = content.match(/## Objective\s+(.+?)(?=\n---|\n##)/s);

  const sections = [...content.matchAll(/^## (.+)/gm)].map(m => m[1]!);
  const checklistItems = (content.match(/- \[[ x~]\]/g) ?? []).length;

  return {
    filePath,
    fileName: basename(filePath),
    format: 'B',
    title: titleMatch?.[1]?.replace(/\s*\(P\d\)\s*$/, '').trim() ?? basename(filePath, '.prompt.md'),
    priority: priorityMatch?.[1] ?? null,
    status: statusMatch?.[1]?.trim() ?? null,
    estimatedTime: timeMatch?.[1]?.trim() ?? null,
    agentType: agentMatch?.[1]?.trim() ?? null,
    revenueImpact: revenueMatch?.[1]?.trim() ?? null,
    objective: objectiveMatch?.[1]?.trim() ?? null,
    hasSuccessCriteria: /## Success Criteria/i.test(content),
    hasTestingChecklist: /## Testing Checklist/i.test(content),
    hasDatabaseSchema: /## Database Schema/i.test(content) || /CREATE TABLE|ALTER TABLE/i.test(content),
    hasReferenceImpl: /Reference Implementation/i.test(content),
    hasCodeExamples: /```(?:typescript|tsx?|javascript|jsx?|sql|bash)/i.test(content),
    sections,
    checklistItems,
    totalLines: lines.length,
    depends: parseDependencies(content),
    raw: content,
  };
}

function parseFormatA(content: string, filePath: string): ParsedPrompt {
  const lines = content.split('\n');

  // YAML frontmatter: lines between first --- and second ---
  const titleMatch = content.match(/^#\s+(.+)/m);
  const descMatch = content.match(/description:\s*['"]?(.+?)['"]?\s*$/m);
  const agentMatch = content.match(/agent:\s*['"]?(.+?)['"]?\s*$/m);

  const sections = [...content.matchAll(/^## (.+)/gm)].map(m => m[1]!);
  const checklistItems = (content.match(/- \[[ x~]\]/g) ?? []).length;

  return {
    filePath,
    fileName: basename(filePath),
    format: 'A',
    title: titleMatch?.[1]?.trim() ?? basename(filePath, '.prompt.md'),
    priority: null, // Format A doesn't have priority
    status: null,
    estimatedTime: null,
    agentType: agentMatch?.[1]?.trim() ?? descMatch?.[1]?.trim() ?? null,
    revenueImpact: null,
    objective: descMatch?.[1]?.trim() ?? null,
    hasSuccessCriteria: /## Success Criteria/i.test(content) || /## Verification/i.test(content),
    hasTestingChecklist: /## Testing/i.test(content) || /## Validation/i.test(content),
    hasDatabaseSchema: /CREATE TABLE|ALTER TABLE/i.test(content),
    hasReferenceImpl: /Reference|Example/i.test(content),
    hasCodeExamples: /```(?:typescript|tsx?|javascript|jsx?|sql|bash)/i.test(content),
    sections,
    checklistItems,
    totalLines: lines.length,
    depends: parseDependencies(content),
    raw: content,
  };
}

async function scanDirectory(dirPath: string, format: 'A' | 'B'): Promise<ParsedPrompt[]> {
  const prompts: ParsedPrompt[] = [];
  try {
    const entries = await readdir(dirPath);
    const promptFiles = entries.filter(f => f.endsWith('.prompt.md'));

    for (const file of promptFiles) {
      try {
        const fullPath = join(dirPath, file);
        const content = await readFile(fullPath, 'utf-8');
        const parsed = format === 'B'
          ? parseFormatB(content, fullPath)
          : parseFormatA(content, fullPath);
        prompts.push(parsed);
      } catch {
        // Skip unreadable files
      }
    }

    // Recurse into immediate subdirectories (one level deep)
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      try {
        const subPath = join(dirPath, entry);
        const info = await stat(subPath);
        if (info.isDirectory()) {
          const subPrompts = await scanDirectory(subPath, format);
          prompts.push(...subPrompts);
        }
      } catch {
        // Skip inaccessible subdirectories
      }
    }
  } catch {
    // Directory doesn't exist — that's fine
  }
  return prompts;
}

// ---------------------------------------------------------------------------
// Shared scan cache — avoids 4x redundant directory reads per cluster run
// ---------------------------------------------------------------------------

const scanCache = new Map<string, ParsedPrompt[]>();

export async function scanAllPrompts(localPath: string): Promise<ParsedPrompt[]> {
  const cached = scanCache.get(localPath);
  if (cached) return cached;

  const formatA = await scanDirectory(join(localPath, '.github', 'prompts'), 'A');
  const formatB = await scanDirectory(join(localPath, 'docs', 'agent-prompts'), 'B');
  const formatBExtra = await scanDirectory(join(localPath, 'docs', 'prompts'), 'B');
  // Also scan docs/prompts/ subdirectories as Format A (YAML frontmatter prompts)
  const formatAExtra = await scanDirectory(join(localPath, 'docs', 'prompts'), 'A');
  // Deduplicate by filePath (same file found by both A and B scanners)
  const byPath = new Map<string, ParsedPrompt>();
  for (const p of [...formatA, ...formatB, ...formatBExtra, ...formatAExtra]) {
    // Prefer Format A parse if file has YAML frontmatter, else keep first found
    const existing = byPath.get(p.filePath);
    if (!existing || (p.format === 'A' && p.objective)) {
      byPath.set(p.filePath, p);
    }
  }
  const all = [...byPath.values()];

  scanCache.set(localPath, all);
  return all;
}

/** Clear the scan cache (call between orchestrator runs if needed) */
export function clearPromptScanCache(): void {
  scanCache.clear();
}

// ---------------------------------------------------------------------------
// Time parsing — handles ranges, weeks, abbreviations, combined formats
// ---------------------------------------------------------------------------

function parseEstimatedTime(timeStr: string): number {
  let days = 0;

  // Handle ranges like "1-2 days" or "2-4 hours" — take the max
  const rangeDay = timeStr.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*(?:days?|d\b)/i);
  const rangeHour = timeStr.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*(?:hours?|h\b|hrs?\b)/i);

  if (rangeDay) {
    days += parseFloat(rangeDay[2]!);
  } else if (rangeHour) {
    days += parseFloat(rangeHour[2]!) / 8;
  } else {
    // Single value matches (accumulate for combined like "2 days 4 hours")
    for (const m of timeStr.matchAll(/(\d+\.?\d*)\s*(?:weeks?|w\b|wks?\b)/gi)) {
      days += parseFloat(m[1]!) * 5;
    }
    for (const m of timeStr.matchAll(/(\d+\.?\d*)\s*(?:days?|d\b)/gi)) {
      days += parseFloat(m[1]!);
    }
    for (const m of timeStr.matchAll(/(\d+\.?\d*)\s*(?:hours?|h\b|hrs?\b)/gi)) {
      days += parseFloat(m[1]!) / 8;
    }
  }

  return days;
}

// ---------------------------------------------------------------------------
// Validation scoring (gold standard)
// ---------------------------------------------------------------------------

export interface ValidationResult {
  prompt: ParsedPrompt;
  score: number;
  maxScore: number;
  percent: number;
  criteria: Array<{ name: string; points: number; maxPoints: number; note: string }>;
}

export function validatePrompt(p: ParsedPrompt): ValidationResult {
  const criteria: ValidationResult['criteria'] = [];

  // 1. Title clarity (10 pts)
  const titleScore = p.title.length > 5 && p.title.length < 120 ? 10 : (p.title.length > 0 ? 5 : 0);
  criteria.push({ name: 'Title', points: titleScore, maxPoints: 10, note: titleScore === 10 ? 'Clear, descriptive' : 'Too short or too long' });

  // 2. Priority assigned (10 pts) — Format B only, Format A gets partial credit
  const priorityScore = p.priority ? 10 : (p.format === 'A' ? 5 : 0);
  criteria.push({ name: 'Priority', points: priorityScore, maxPoints: 10, note: p.priority ? `${p.priority}` : (p.format === 'A' ? 'Format A — no priority system' : 'Missing priority') });

  // 3. Objective / description (15 pts)
  const objScore = p.objective && p.objective.length > 20 ? 15 : (p.objective ? 8 : 0);
  criteria.push({ name: 'Objective', points: objScore, maxPoints: 15, note: objScore === 15 ? 'Detailed objective' : (p.objective ? 'Objective too brief' : 'Missing objective') });

  // 4. Structured sections (10 pts)
  const sectionScore = p.sections.length >= 4 ? 10 : (p.sections.length >= 2 ? 6 : (p.sections.length >= 1 ? 3 : 0));
  criteria.push({ name: 'Sections', points: sectionScore, maxPoints: 10, note: `${p.sections.length} sections` });

  // 5. Success criteria (10 pts)
  const successScore = p.hasSuccessCriteria ? 10 : 0;
  criteria.push({ name: 'Success Criteria', points: successScore, maxPoints: 10, note: successScore ? 'Present' : 'Missing' });

  // 6. Testing checklist (10 pts)
  const testScore = p.hasTestingChecklist ? 10 : 0;
  criteria.push({ name: 'Testing Checklist', points: testScore, maxPoints: 10, note: testScore ? 'Present' : 'Missing' });

  // 7. Code examples (10 pts)
  const codeScore = p.hasCodeExamples ? 10 : 0;
  criteria.push({ name: 'Code Examples', points: codeScore, maxPoints: 10, note: codeScore ? 'Present' : 'Missing' });

  // 8. Estimated time (5 pts)
  const timeScore = p.estimatedTime ? 5 : 0;
  criteria.push({ name: 'Time Estimate', points: timeScore, maxPoints: 5, note: p.estimatedTime ?? 'Missing' });

  // 9. Revenue / impact statement (5 pts)
  const revenueScore = p.revenueImpact ? 5 : 0;
  criteria.push({ name: 'Revenue Impact', points: revenueScore, maxPoints: 5, note: p.revenueImpact ?? 'Missing' });

  // 10. Checklists / actionable items (5 pts)
  const checkScore = p.checklistItems >= 3 ? 5 : (p.checklistItems >= 1 ? 3 : 0);
  criteria.push({ name: 'Checklists', points: checkScore, maxPoints: 5, note: `${p.checklistItems} items` });

  // 11. Reference implementation (5 pts)
  const refScore = p.hasReferenceImpl ? 5 : 0;
  criteria.push({ name: 'Reference Impl', points: refScore, maxPoints: 5, note: refScore ? 'Present' : 'Missing' });

  // 12. Content depth — lines > 100 = full, > 50 = partial (5 pts)
  const depthScore = p.totalLines >= 100 ? 5 : (p.totalLines >= 50 ? 3 : 1);
  criteria.push({ name: 'Content Depth', points: depthScore, maxPoints: 5, note: `${p.totalLines} lines` });

  const totalPoints = criteria.reduce((sum, c) => sum + c.points, 0);
  const maxPoints = criteria.reduce((sum, c) => sum + c.maxPoints, 0);

  return {
    prompt: p,
    score: totalPoints,
    maxScore: maxPoints,
    percent: Math.round((totalPoints / maxPoints) * 100),
    criteria,
  };
}

// ---------------------------------------------------------------------------
// Issue body builder
// ---------------------------------------------------------------------------

function buildIssueBody(p: ParsedPrompt): string {
  const lines: string[] = [];

  lines.push(`> Auto-generated from \`${p.fileName}\` by UGWTF Prompt Scanner`);
  lines.push('');

  if (p.objective) {
    lines.push('## Objective');
    lines.push(p.objective);
    lines.push('');
  }

  if (p.estimatedTime) lines.push(`**Estimated Time**: ${p.estimatedTime}`);
  if (p.agentType) lines.push(`**Agent Type**: ${p.agentType}`);
  if (p.revenueImpact) lines.push(`**Revenue Impact**: ${p.revenueImpact}`);
  lines.push('');

  lines.push('## Sections');
  for (const s of p.sections) {
    lines.push(`- ${s}`);
  }
  lines.push('');

  if (p.hasSuccessCriteria) lines.push('- [x] Has Success Criteria');
  if (p.hasTestingChecklist) lines.push('- [x] Has Testing Checklist');
  if (p.hasDatabaseSchema) lines.push('- [x] Has Database Schema');
  if (p.hasCodeExamples) lines.push('- [x] Has Code Examples');
  if (p.hasReferenceImpl) lines.push('- [x] Has Reference Implementation');
  lines.push('');

  lines.push(`**Source**: \`${p.filePath}\``);
  lines.push(`**Lines**: ${p.totalLines} | **Checklists**: ${p.checklistItems}`);

  return lines.join('\n');
}

function priorityToLabel(priority: string | null): string {
  if (!priority) return 'priority:p2'; // default to medium
  const num = priority.replace(/^P/i, '');
  const n = parseInt(num);
  if (n <= 0) return 'priority:p0';
  if (n === 1) return 'priority:p1';
  if (n === 2) return 'priority:p2';
  return 'priority:p3'; // P3 and above
}

// ---------------------------------------------------------------------------
// Agent 1: Prompt Scanner
// ---------------------------------------------------------------------------

const promptScanner: Agent = {
  id: 'prompt-scanner',
  name: 'Prompt Scanner',
  description: 'Scan repos for .prompt.md files in .github/prompts/ and docs/agent-prompts/',
  clusterId: 'prompts',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    const repoConfig = getRepo(ctx.repoAlias);
    if (!repoConfig) {
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: 0, message: 'No config', artifacts: [] };
    }

    const localPath = ctx.localPath;
    ctx.logger.group(`Scanning prompts in ${ctx.repoAlias}`);

    const allPrompts = await scanAllPrompts(localPath);

    const completed = allPrompts.filter(p => p.status?.includes('COMPLETE'));
    const actionable = allPrompts.filter(p => !p.status?.includes('COMPLETE'));

    ctx.logger.info(`Found ${allPrompts.length} prompt files (${allPrompts.filter(p => p.format === 'A').length} Format A, ${allPrompts.filter(p => p.format === 'B').length} Format B)`);
    ctx.logger.info(`Actionable: ${actionable.length} | Completed: ${completed.length}`);

    for (const p of actionable) {
      const pri = p.priority ?? 'N/A';
      ctx.logger.info(`  ${pri} — ${p.title} [${p.fileName}]`);
    }

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Found ${allPrompts.length} prompts (${actionable.length} actionable, ${completed.length} completed)`,
      artifacts: allPrompts.map(p => `${p.format}:${p.priority ?? '-'}:${p.status ?? 'unknown'}:${p.fileName}`),
    };
  },
};

// ---------------------------------------------------------------------------
// Agent 2: Prompt Validator
// ---------------------------------------------------------------------------

const promptValidator: Agent = {
  id: 'prompt-validator',
  name: 'Prompt Validator',
  description: 'Score each prompt 0-100 against gold-standard criteria (12-point system)',
  clusterId: 'prompts',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    const repoConfig = getRepo(ctx.repoAlias);
    if (!repoConfig) {
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: 0, message: 'No config', artifacts: [] };
    }

    const localPath = ctx.localPath;
    ctx.logger.group(`Validating prompts in ${ctx.repoAlias}`);

    const allPrompts = await scanAllPrompts(localPath);

    if (allPrompts.length === 0) {
      ctx.logger.info('No prompts found — skipping validation');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: 'No prompts found', artifacts: [] };
    }

    const results: ValidationResult[] = allPrompts.map(p => validatePrompt(p));
    const avgScore = Math.round(results.reduce((s, r) => s + r.percent, 0) / results.length);

    const perfect = results.filter(r => r.percent === 100);
    const passing = results.filter(r => r.percent >= 80);
    const failing = results.filter(r => r.percent < 80);

    ctx.logger.info(`Average score: ${avgScore}%`);
    ctx.logger.info(`Perfect (100%): ${perfect.length} | Passing (≥80%): ${passing.length} | Failing (<80%): ${failing.length}`);
    ctx.logger.info('');

    // Print per-prompt scores
    for (const r of results) {
      const icon = r.percent >= 80 ? '✅' : (r.percent >= 50 ? '⚠️' : '❌');
      ctx.logger.info(`  ${icon} ${r.percent}% — ${r.prompt.fileName}`);

      // Show failing criteria for <100 prompts
      if (r.percent < 100) {
        for (const c of r.criteria) {
          if (c.points < c.maxPoints) {
            ctx.logger.debug(`     -${c.maxPoints - c.points} ${c.name}: ${c.note}`);
          }
        }
      }
    }

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: avgScore >= 80 ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Avg score: ${avgScore}% | Perfect: ${perfect.length}/${results.length} | Passing: ${passing.length}/${results.length}`,
      artifacts: results.map(r => `${r.percent}%:${r.prompt.fileName}`),
    };
  },
};

// ---------------------------------------------------------------------------
// Agent 3: Prompt-to-Issue Creator
// ---------------------------------------------------------------------------

function parseSlug(slug: string): { owner: string; repo: string } {
  const parts = slug.split('/');
  return { owner: parts[0]!, repo: parts[1]! };
}

const promptIssueCreator: Agent = {
  id: 'prompt-issue-creator',
  name: 'Prompt Issue Creator',
  description: 'Create GitHub Issues from actionable (non-completed) prompts',
  clusterId: 'prompts',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    const repoConfig = getRepo(ctx.repoAlias);
    if (!repoConfig) {
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: 0, message: 'No config', artifacts: [] };
    }

    const { owner, repo } = parseSlug(repoConfig.slug);
    const localPath = ctx.localPath;

    ctx.logger.group(`Creating issues from prompts in ${ctx.repoAlias}`);

    const allPrompts = await scanAllPrompts(localPath);

    // Filter to actionable prompts only
    const actionable = allPrompts.filter(p => !p.status?.includes('COMPLETE'));

    if (actionable.length === 0) {
      ctx.logger.info('No actionable prompts — all complete or none found');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'success', repo: ctx.repoAlias, duration: Date.now() - start, message: 'No actionable prompts', artifacts: [] };
    }

    // Fetch existing issues to avoid duplicates
    const existingIssues = await ctx.github.listIssues(owner, repo, 'all');
    const existingTitles = new Set(existingIssues.map(i => i.title.toLowerCase()));

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const p of actionable) {
      const issueTitle = p.priority
        ? `${p.priority}: ${p.title}`
        : p.title;

      // Duplicate check
      if (existingTitles.has(issueTitle.toLowerCase())) {
        ctx.logger.debug(`Skipping duplicate: ${issueTitle}`);
        skipped++;
        continue;
      }

      const labels = [
        priorityToLabel(p.priority),
        'automation:copilot',
        'agent:copilot',
        'enhancement',
      ];

      // Add database label if prompt has DB schema
      if (p.hasDatabaseSchema) labels.push('database');

      const body = buildIssueBody(p);

      if (ctx.dryRun) {
        ctx.logger.info(`[DRY RUN] Would create: "${issueTitle}" [${labels.join(', ')}]`);
        created++;
        continue;
      }

      try {
        const issue = await ctx.github.createIssue(owner, repo, {
          title: issueTitle,
          body,
          labels,
        });
        created++;
        ctx.logger.success(`Created #${issue.number}: ${issueTitle}`);
      } catch (err) {
        errors.push(`${p.fileName}: ${err}`);
        ctx.logger.error(`Failed: ${p.fileName}: ${err}`);
      }
    }

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: errors.length > 0 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Created: ${created} | Skipped (dup): ${skipped} | Errors: ${errors.length}`,
      artifacts: errors,
    };
  },
};

// ---------------------------------------------------------------------------
// Agent 4: Prompt Forecaster (30x logic)
// ---------------------------------------------------------------------------

const promptForecaster: Agent = {
  id: 'prompt-forecaster',
  name: 'Prompt Forecaster',
  description: '30x forecasting: effort estimation, revenue impact, blocked detection, deployment planning',
  clusterId: 'prompts',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    const repoConfig = getRepo(ctx.repoAlias);
    if (!repoConfig) {
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: 0, message: 'No config', artifacts: [] };
    }

    const localPath = ctx.localPath;
    ctx.logger.group(`30x Forecast for ${ctx.repoAlias}`);

    const allPrompts = await scanAllPrompts(localPath);

    if (allPrompts.length === 0) {
      ctx.logger.info('No prompts found');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: 'No prompts', artifacts: [] };
    }

    // Categorize
    const completed = allPrompts.filter(p => p.status?.includes('COMPLETE'));
    const actionable = allPrompts.filter(p => !p.status?.includes('COMPLETE'));
    const withDB = actionable.filter(p => p.hasDatabaseSchema);
    const p0p1 = actionable.filter(p => p.priority && parseInt(p.priority.replace('P', '')) <= 1);
    const p2p3 = actionable.filter(p => p.priority && parseInt(p.priority.replace('P', '')) >= 2 && parseInt(p.priority.replace('P', '')) <= 3);

    // Parse estimated times into total days
    let totalDays = 0;
    for (const p of actionable) {
      if (p.estimatedTime) {
        totalDays += parseEstimatedTime(p.estimatedTime);
      }
    }

    // Validate scores
    const validations = allPrompts.map(p => validatePrompt(p));
    const avgScore = Math.round(validations.reduce((s, v) => s + v.percent, 0) / validations.length);

    // 30x metrics
    const completionRate = allPrompts.length > 0
      ? Math.round((completed.length / allPrompts.length) * 100)
      : 0;

    const readinessScore = Math.round(
      (avgScore * 0.4) +                                                      // prompt quality
      (completionRate * 0.3) +                                                 // execution rate
      ((p0p1.length === 0 ? 100 : Math.max(0, 100 - p0p1.length * 15)) * 0.3) // critical backlog
    );

    // Risk assessment
    const risks: string[] = [];
    if (withDB.length > 0) risks.push(`${withDB.length} prompts require DB migrations (manual intervention)`);
    if (p0p1.length > 3) risks.push(`${p0p1.length} critical (P0-P1) prompts pending — high backlog`);
    if (avgScore < 80) risks.push(`Average prompt quality ${avgScore}% — below 80% threshold`);
    if (totalDays > 20) risks.push(`${totalDays} total days of work — consider parallelization`);

    // Print forecast
    ctx.logger.info('╔═══════════════════════════════════════╗');
    ctx.logger.info('║        30x DEPLOYMENT FORECAST        ║');
    ctx.logger.info('╚═══════════════════════════════════════╝');
    ctx.logger.info('');
    ctx.logger.info(`Total Prompts:    ${allPrompts.length}`);
    ctx.logger.info(`Completed:        ${completed.length} (${completionRate}%)`);
    ctx.logger.info(`Actionable:       ${actionable.length}`);
    ctx.logger.info(`  P0-P1 Critical: ${p0p1.length}`);
    ctx.logger.info(`  P2-P3 Standard: ${p2p3.length}`);
    ctx.logger.info(`  No Priority:    ${actionable.length - p0p1.length - p2p3.length}`);
    ctx.logger.info(`DB Migrations:    ${withDB.length}`);
    ctx.logger.info(`Est. Total Effort: ${totalDays.toFixed(1)} days`);
    ctx.logger.info('');
    ctx.logger.info(`Avg Prompt Quality: ${avgScore}%`);
    ctx.logger.info(`Completion Rate:    ${completionRate}%`);
    ctx.logger.info(`Readiness Score:    ${readinessScore}%`);
    ctx.logger.info('');

    if (risks.length > 0) {
      ctx.logger.warn('RISKS:');
      for (const r of risks) ctx.logger.warn(`  ⚠ ${r}`);
    } else {
      ctx.logger.success('No significant risks identified');
    }

    // Deployment recommendation
    ctx.logger.info('');
    if (readinessScore >= 80) {
      ctx.logger.success('RECOMMENDATION: Ready for automated deployment via Copilot pipeline');
    } else if (readinessScore >= 60) {
      ctx.logger.warn('RECOMMENDATION: Address critical prompts before full deployment');
    } else {
      ctx.logger.error('RECOMMENDATION: Significant prompt gaps — manual review required');
    }

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Readiness: ${readinessScore}% | Effort: ${totalDays.toFixed(1)}d | Quality: ${avgScore}% | Risks: ${risks.length}`,
      artifacts: [
        `readiness:${readinessScore}`,
        `effort:${totalDays.toFixed(1)}d`,
        `quality:${avgScore}%`,
        `completion:${completionRate}%`,
        `critical:${p0p1.length}`,
        ...risks.map(r => `RISK: ${r}`),
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const promptAgents: Agent[] = [promptScanner, promptValidator, promptIssueCreator, promptForecaster];
