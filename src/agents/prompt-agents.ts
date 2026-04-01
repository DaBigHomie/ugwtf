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
import type { Agent, AgentResult, AgentContext } from '../types.js';
import { getRepo } from '../config/repo-registry.js';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';

import {
  type ParsedPrompt,
  type ValidationResult,
  scanAllPrompts,
  validatePrompt,
  parseEstimatedTime,
  fixAllPrompts,
  type FixResult,
} from '../prompt/index.js';

// Re-export for backward-compat consumers that import from this file
export type { ParsedPrompt, ValidationResult, FixResult };
export { scanAllPrompts, validatePrompt, parseDependencies, clearPromptScanCache, fixAllPrompts } from '../prompt/index.js';

/**
 * Filter prompts by --path flag (folder or single file).
 * Uses filesystem stat to determine if the path is a file or directory —
 * no heuristics, no extension checks.
 * Returns the full set when no --path is provided.
 */
async function filterByPath(
  allPrompts: ParsedPrompt[],
  localPath: string,
  ctx: AgentContext,
): Promise<{ prompts: ParsedPrompt[]; scoped: boolean }> {
  if (!ctx.extras.path) return { prompts: allPrompts, scoped: false };

  const target = join(localPath, ctx.extras.path);

  let filtered: ParsedPrompt[];
  try {
    const st = await stat(target);
    if (st.isFile()) {
      filtered = allPrompts.filter(p => p.filePath === target);
    } else if (st.isDirectory()) {
      const dirPrefix = target.endsWith('/') ? target : target + '/';
      filtered = allPrompts.filter(p => p.filePath.startsWith(dirPrefix));
    } else {
      filtered = [];
    }
  } catch {
    ctx.logger.warn(`--path ${ctx.extras.path} does not exist on disk`);
    filtered = [];
  }

  if (filtered.length === 0) {
    ctx.logger.warn(`No prompts found in --path ${ctx.extras.path} (${allPrompts.length} total in repo)`);
  } else {
    ctx.logger.info(`Scoped to ${filtered.length} prompts from --path ${ctx.extras.path} (${allPrompts.length} total in repo)`);
  }
  return { prompts: filtered, scoped: true };
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
    const { prompts, scoped } = await filterByPath(allPrompts, localPath, ctx);

    if (scoped && prompts.length === 0) {
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: `No prompts in ${ctx.extras.path}`, artifacts: [] };
    }

    const completed = prompts.filter(p => p.status?.includes('COMPLETE'));
    const actionable = prompts.filter(p => !p.status?.includes('COMPLETE'));

    ctx.logger.info(`Found ${prompts.length} prompt files (${prompts.filter(p => p.format === 'A').length} Format A, ${prompts.filter(p => p.format === 'B').length} Format B)`);
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
      message: `Found ${prompts.length} prompts (${actionable.length} actionable, ${completed.length} completed)`,
      artifacts: prompts.map(p => `${p.format}:${p.priority ?? '-'}:${p.status ?? 'unknown'}:${p.fileName}`),
    };
  },
};

// ---------------------------------------------------------------------------
// Agent 2: Prompt Validator
// ---------------------------------------------------------------------------

const promptValidator: Agent = {
  id: 'prompt-validator',
  name: 'Prompt Validator',
  description: 'Score each prompt 0-100 against gold-standard criteria (24-point system)',
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
    const { prompts, scoped } = await filterByPath(allPrompts, localPath, ctx);

    if (prompts.length === 0) {
      ctx.logger.info(scoped ? `No prompts in --path ${ctx.extras.path}` : 'No prompts found — skipping validation');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: scoped ? `No prompts in ${ctx.extras.path}` : 'No prompts found', artifacts: [] };
    }

    const results: ValidationResult[] = prompts.map(p => validatePrompt(p));
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
    const { prompts, scoped } = await filterByPath(allPrompts, localPath, ctx);

    if (scoped && prompts.length === 0) {
      ctx.logger.warn(`No prompts in --path ${ctx.extras.path}`);
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: `No prompts in ${ctx.extras.path}`, artifacts: [] };
    }

    // Filter to actionable prompts only
    const actionable = prompts.filter(p => !p.status?.includes('COMPLETE'));

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

    for (let idx = 0; idx < actionable.length; idx++) {
      const p = actionable[idx]!;
      const spNum = String(idx + 1).padStart(2, '0');
      const commitType = p.type ?? 'feat';
      const scope = p.scope ?? 'shop';
      const description = p.title
        .replace(/^30X\s+/i, '')           // strip "30X " prefix
        .replace(/^P\d+[A-Z]?[-:]?\s*/i, '') // strip "P4A: " or "P0: " prefix
        .trim();
      const issueTitle = `${commitType}(${scope}): ${description.toLowerCase()} [SP-${spNum}]`;

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
        'prompt-spec',
        'needs-pr',
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
    const { prompts, scoped } = await filterByPath(allPrompts, localPath, ctx);

    if (prompts.length === 0) {
      ctx.logger.info(scoped ? `No prompts in --path ${ctx.extras.path}` : 'No prompts found');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: scoped ? `No prompts in ${ctx.extras.path}` : 'No prompts', artifacts: [] };
    }

    // Categorize
    const completed = prompts.filter(p => p.status?.includes('COMPLETE'));
    const actionable = prompts.filter(p => !p.status?.includes('COMPLETE'));
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
    const validations = prompts.map(p => validatePrompt(p));
    const avgScore = Math.round(validations.reduce((s, v) => s + v.percent, 0) / validations.length);

    // 30x metrics
    const completionRate = prompts.length > 0
      ? Math.round((completed.length / prompts.length) * 100)
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
    ctx.logger.info(`Total Prompts:    ${prompts.length}`);
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
// Agent 5: Prompt Fixer
// ---------------------------------------------------------------------------

const promptFixer: Agent = {
  id: 'prompt-fixer',
  name: 'Prompt Fixer',
  description: 'Auto-fix prompts: inject missing sections, fix tags, upgrade to 24-point standard',
  clusterId: 'prompts',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    const repoConfig = getRepo(ctx.repoAlias);
    if (!repoConfig) {
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: 0, message: 'No config', artifacts: [] };
    }

    const localPath = ctx.localPath;
    ctx.logger.group(`Fixing prompts in ${ctx.repoAlias}`);

    const results = await fixAllPrompts(localPath, {
      path: ctx.extras.path,
      dryRun: ctx.dryRun,
    });

    if (results.length === 0) {
      ctx.logger.info('No prompts found to fix');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: 'No prompts found', artifacts: [] };
    }

    let improved = 0;
    let unchanged = 0;

    for (const r of results) {
      if (r.sectionsAdded.length > 0 || r.tagsFixed) {
        improved++;
        const mode = ctx.dryRun ? '[DRY RUN] ' : '';
        ctx.logger.info(`${mode}${r.fileName}: ${r.beforePercent}% → ${r.afterPercent}% (+${r.sectionsAdded.length} sections${r.tagsFixed ? ', tags fixed' : ''})`);
        if (r.sectionsAdded.length > 0) {
          ctx.logger.debug(`  Added: ${r.sectionsAdded.join(', ')}`);
        }
      } else {
        unchanged++;
        ctx.logger.debug(`${r.fileName}: ${r.beforePercent}% — no changes needed`);
      }
    }

    const avgBefore = Math.round(results.reduce((s, r) => s + r.beforePercent, 0) / results.length);
    const avgAfter = Math.round(results.reduce((s, r) => s + r.afterPercent, 0) / results.length);

    ctx.logger.info('');
    ctx.logger.info(`Summary: ${improved} improved, ${unchanged} unchanged`);
    ctx.logger.info(`Average score: ${avgBefore}% → ${avgAfter}%`);

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Fixed ${improved}/${results.length} prompts | Avg: ${avgBefore}% → ${avgAfter}%`,
      artifacts: results
        .filter(r => r.sectionsAdded.length > 0 || r.tagsFixed)
        .map(r => `${r.beforePercent}→${r.afterPercent}%:${r.fileName}`),
    };
  },
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const promptAgents: Agent[] = [promptScanner, promptValidator, promptIssueCreator, promptForecaster, promptFixer];
