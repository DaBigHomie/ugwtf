/**
 * Audit Agents
 *
 * Full-stack audit of repo health: labels, workflows, quality, issues, PRs.
 * Generates scoreboard with per-domain scores.
 */
import type { Agent, AgentResult, AgentContext } from '../types.js';
import { getRepo, UNIVERSAL_LABELS, allAliases } from '../config/repo-registry.js';
import { writeFile } from '../utils/fs.js';
import { join } from 'node:path';

function parseSlug(slug: string): { owner: string; repo: string } {
  const parts = slug.split('/');
  return { owner: parts[0]!, repo: parts[1]! };
}

interface AuditDomain {
  name: string;
  score: number;   // 0-100
  maxScore: number;
  findings: string[];
}

async function auditLabels(ctx: AgentContext): Promise<AuditDomain> {
  const repoConfig = getRepo(ctx.repoAlias);
  if (!repoConfig) return { name: 'Labels', score: 0, maxScore: 100, findings: ['No repo config'] };

  const { owner, repo } = parseSlug(repoConfig.slug);
  const existing = await ctx.github.listLabels(owner, repo);
  const existingNames = new Set(existing.map(l => l.name));

  const findings: string[] = [];
  let missing = 0;
  for (const label of UNIVERSAL_LABELS) {
    if (!existingNames.has(label.name)) {
      findings.push(`Missing label: ${label.name}`);
      missing++;
    }
  }

  const expectedCount = UNIVERSAL_LABELS.length + (repoConfig.extraLabels?.length ?? 0);
  const score = Math.round(((expectedCount - missing) / expectedCount) * 100);
  return { name: 'Labels', score, maxScore: 100, findings };
}

async function auditWorkflows(ctx: AgentContext): Promise<AuditDomain> {
  const repoConfig = getRepo(ctx.repoAlias);
  if (!repoConfig) return { name: 'Workflows', score: 0, maxScore: 100, findings: ['No repo config'] };

  const { owner, repo } = parseSlug(repoConfig.slug);
  const requiredWorkflows = ['ci.yml', 'copilot-full-automation.yml'];
  const optionalWorkflows = ['security-audit.yml', 'dependabot-auto-merge.yml'];
  if (repoConfig.supabaseProjectId) {
    requiredWorkflows.push('supabase-migration-automation.yml');
  }

  const findings: string[] = [];
  let present = 0;
  const totalRequired = requiredWorkflows.length;

  for (const wf of requiredWorkflows) {
    try {
      await ctx.github.getFileContents(owner, repo, `.github/workflows/${wf}`);
      present++;
    } catch {
      findings.push(`Missing required workflow: ${wf}`);
    }
  }

  for (const wf of optionalWorkflows) {
    try {
      await ctx.github.getFileContents(owner, repo, `.github/workflows/${wf}`);
    } catch {
      findings.push(`Missing optional workflow: ${wf}`);
    }
  }

  // Check for recent workflow runs
  const runs = await ctx.github.listWorkflowRuns(owner, repo);
  const failedRuns = runs.filter(r => r.conclusion === 'failure' && r.status === 'completed');
  if (failedRuns.length > 0) {
    findings.push(`${failedRuns.length} recent failed workflow runs`);
  }

  const score = Math.round((present / totalRequired) * 100);
  return { name: 'Workflows', score, maxScore: 100, findings };
}

async function auditIssues(ctx: AgentContext): Promise<AuditDomain> {
  const repoConfig = getRepo(ctx.repoAlias);
  if (!repoConfig) return { name: 'Issues', score: 0, maxScore: 100, findings: ['No repo config'] };

  const { owner, repo } = parseSlug(repoConfig.slug);
  const issues = await ctx.github.listIssues(owner, repo, 'open');

  const findings: string[] = [];

  // Check for unlabeled issues
  const unlabeled = issues.filter(i => i.labels.length === 0);
  if (unlabeled.length > 0) {
    findings.push(`${unlabeled.length} unlabeled issues`);
  }

  // Check for unassigned issues
  const unassigned = issues.filter(i => i.assignees.length === 0);
  if (unassigned.length > 0) {
    findings.push(`${unassigned.length} unassigned issues`);
  }

  // Check for stalled items
  const stalled = issues.filter(i =>
    i.labels.some(l => l.name === 'stalled' || l.name === 'automation:in-progress')
  );
  if (stalled.length > 0) {
    findings.push(`${stalled.length} potentially stalled issues`);
  }

  // Cap each category to prevent a single issue type from tanking the whole domain
  const deductions = Math.min(25, unlabeled.length * 5) + Math.min(15, unassigned.length * 3) + Math.min(30, stalled.length * 10);
  const score = Math.max(0, 100 - deductions);
  return { name: 'Issues', score, maxScore: 100, findings };
}

async function auditPRs(ctx: AgentContext): Promise<AuditDomain> {
  const repoConfig = getRepo(ctx.repoAlias);
  if (!repoConfig) return { name: 'PRs', score: 0, maxScore: 100, findings: ['No repo config'] };

  const { owner, repo } = parseSlug(repoConfig.slug);
  const prs = await ctx.github.listPRs(owner, repo, 'open');

  const findings: string[] = [];

  // Check for draft PRs
  const drafts = prs.filter(p => p.draft);
  if (drafts.length > 0) {
    findings.push(`${drafts.length} draft PRs open`);
  }

  // Check for PRs without reviews
  const unreviewedCopilot = prs.filter(p =>
    (p.labels.some(l => l.name === 'automation:copilot') || p.head.ref.startsWith('copilot/')) &&
    !p.labels.some(l => l.name === 'approved')
  );
  if (unreviewedCopilot.length > 0) {
    findings.push(`${unreviewedCopilot.length} Copilot PRs awaiting review`);
  }

  // Check for DB migration PRs without firewall label
  const dbPRsNoLabel = prs.filter(p => {
    const hasDBRef = (p.title.toLowerCase().includes('migration') || p.title.toLowerCase().includes('database'));
    const hasLabel = p.labels.some(l => l.name === 'database');
    return hasDBRef && !hasLabel;
  });
  if (dbPRsNoLabel.length > 0) {
    findings.push(`${dbPRsNoLabel.length} potential DB migration PRs missing 'database' label`);
  }

  // Check for stale dependabot PRs (open > 14 days)
  const now = Date.now();
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;
  const staleDependabot = prs.filter(p => {
    const isDependabot = p.user.login === 'dependabot[bot]' || p.labels.some(l => l.name === 'dependencies');
    const age = now - new Date(p.created_at).getTime();
    return isDependabot && age > fourteenDays;
  });
  if (staleDependabot.length > 0) {
    findings.push(`${staleDependabot.length} stale dependabot PRs (>14 days) — merge or close`);
  }

  // Check for duplicate Copilot PRs (same title or similar branch prefix)
  const copilotPRs = prs.filter(p =>
    p.user.login === 'copilot' || p.head.ref.startsWith('copilot/')
  );
  const seenTitles = new Map<string, number>();
  for (const pr of copilotPRs) {
    const normalized = pr.title.replace(/\[WIP\]\s*/i, '').trim().toLowerCase();
    if (seenTitles.has(normalized)) {
      findings.push(`Duplicate Copilot PRs: #${seenTitles.get(normalized)} and #${pr.number} ("${pr.title}")`);
    } else {
      seenTitles.set(normalized, pr.number);
    }
  }

  // Check for PRs with no labels at all
  const unlabeledPRs = prs.filter(p => p.labels.length === 0 && p.user.login !== 'dependabot[bot]');
  if (unlabeledPRs.length > 0) {
    findings.push(`${unlabeledPRs.length} PRs with no labels`);
  }

  // Check for old open PRs (> 30 days)
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const stalePRs = prs.filter(p => {
    const age = now - new Date(p.updated_at).getTime();
    return age > thirtyDays;
  });
  if (stalePRs.length > 0) {
    findings.push(`${stalePRs.length} stale PRs (no activity >30 days)`);
  }

  // Cap each category to prevent a single issue type from tanking the whole domain
  const deductions = Math.min(15, drafts.length * 5)
    + Math.min(20, unreviewedCopilot.length * 8)
    + Math.min(15, dbPRsNoLabel.length * 15)
    + Math.min(25, staleDependabot.length * 5)
    + Math.min(10, unlabeledPRs.length * 3)
    + Math.min(15, stalePRs.length * 5);
  const score = Math.max(0, 100 - deductions);
  return { name: 'PRs', score, maxScore: 100, findings };
}

async function auditBranches(ctx: AgentContext): Promise<AuditDomain> {
  const repoConfig = getRepo(ctx.repoAlias);
  if (!repoConfig) return { name: 'Branches', score: 0, maxScore: 100, findings: ['No repo config'] };

  const { owner, repo } = parseSlug(repoConfig.slug);
  const branches = await ctx.github.listBranches(owner, repo);

  const findings: string[] = [];

  // Detect copilot/* branches that should have been cleaned up
  const copilotBranches = branches.filter(b => b.name.startsWith('copilot/'));
  if (copilotBranches.length > 3) {
    findings.push(`${copilotBranches.length} copilot/* branches — consider cleanup`);
  }

  // Detect total branch count (>20 is noisy)
  const protectedBranches = ['main', 'master', 'develop', 'staging'];
  const featureBranches = branches.filter(b => !protectedBranches.includes(b.name));
  if (featureBranches.length > 20) {
    findings.push(`${featureBranches.length} non-protected branches — stale branch accumulation`);
  }

  // Cap each category to prevent a single issue type from tanking the whole domain
  const deductions = Math.min(25, Math.max(0, copilotBranches.length - 3) * 2)
    + (featureBranches.length > 20 ? Math.min(20, (featureBranches.length - 20)) : 0);
  const score = Math.max(0, 100 - deductions);
  return { name: 'Branches', score, maxScore: 100, findings };
}

const fullAuditAgent: Agent = {
  id: 'audit-full',
  name: 'Full Repository Audit',
  description: 'Run all audit domains and produce a combined health report',
  clusterId: 'audit',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();

    ctx.logger.group(`Full audit: ${ctx.repoAlias}`);
    const domains: AuditDomain[] = [];

    domains.push(await auditLabels(ctx));
    domains.push(await auditWorkflows(ctx));
    domains.push(await auditIssues(ctx));
    domains.push(await auditPRs(ctx));
    domains.push(await auditBranches(ctx));

    const overallScore = Math.round(
      domains.reduce((sum, d) => sum + d.score, 0) / domains.length
    );

    // Build report
    const lines: string[] = [
      `# Audit Report: ${ctx.repoAlias}`,
      `**Overall Score: ${overallScore}%**`,
      '',
      '| Domain | Score | Findings |',
      '|--------|-------|----------|',
    ];

    for (const d of domains) {
      const emoji = d.score >= 80 ? '✅' : d.score >= 50 ? '⚠️' : '❌';
      lines.push(`| ${emoji} ${d.name} | ${d.score}/${d.maxScore} | ${d.findings.length} |`);
    }

    lines.push('');
    for (const d of domains) {
      if (d.findings.length > 0) {
        lines.push(`### ${d.name} Findings`);
        for (const f of d.findings) {
          lines.push(`- ${f}`);
        }
        lines.push('');
      }
    }

    ctx.logger.info(lines.join('\n'));
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: overallScore >= 50 ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Score: ${overallScore}% (${domains.filter(d => d.score >= 80).length}/${domains.length} passing)`,
      artifacts: [lines.join('\n')],
    };
  },
};

const scoreboardAgent: Agent = {
  id: 'audit-scoreboard',
  name: 'Scoreboard Generator',
  description: 'Generate cross-repo SCOREBOARD.json with audit scores per repo',
  clusterId: 'audit',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();

    // This agent runs the audit for ALL repos and writes a scoreboard
    const aliases = allAliases();
    const scores: Record<string, { score: number; domains: Record<string, number>; timestamp: string }> = {};

    ctx.logger.group('Generating cross-repo scoreboard');

    for (const alias of aliases) {
      const repoConfig = getRepo(alias);
      if (!repoConfig) continue;

      // Create a sub-context for each repo
      const subCtx: AgentContext = { ...ctx, repoAlias: alias };

      try {
        const labels = await auditLabels(subCtx);
        const workflows = await auditWorkflows(subCtx);
        const issues = await auditIssues(subCtx);
        const prs = await auditPRs(subCtx);
        const branches = await auditBranches(subCtx);

        const overall = Math.round((labels.score + workflows.score + issues.score + prs.score + branches.score) / 5);
        scores[alias] = {
          score: overall,
          domains: {
            labels: labels.score,
            workflows: workflows.score,
            issues: issues.score,
            prs: prs.score,
            branches: branches.score,
          },
          timestamp: new Date().toISOString(),
        };
        ctx.logger.info(`${alias}: ${overall}%`);
      } catch (err) {
        ctx.logger.warn(`Failed to audit ${alias}: ${err instanceof Error ? err.message : String(err)}`);
        scores[alias] = {
          score: 0,
          domains: { labels: 0, workflows: 0, issues: 0, prs: 0, branches: 0 },
          timestamp: new Date().toISOString(),
        };
      }
    }

    ctx.logger.groupEnd();

    const scoreboard = {
      generated: new Date().toISOString(),
      repos: scores,
      summary: {
        total: Object.keys(scores).length,
        passing: Object.values(scores).filter(s => s.score >= 80).length,
        average: Math.round(Object.values(scores).reduce((sum, s) => sum + s.score, 0) / Object.keys(scores).length),
      },
    };

    const content = JSON.stringify(scoreboard, null, 2);

    if (!ctx.dryRun) {
      const outPath = join(process.cwd(), 'SCOREBOARD.json');
      writeFile(outPath, content);
    }

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Scoreboard: ${scoreboard.summary.passing}/${scoreboard.summary.total} passing (avg ${scoreboard.summary.average}%)`,
      artifacts: [content],
    };
  },
};

export const auditAgents: Agent[] = [fullAuditAgent, scoreboardAgent];
