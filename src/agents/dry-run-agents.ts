/**
 * E2E Dry-Run Agent — Validate full chain pipeline without making changes.
 *
 * Traces every step of the UGWTF→GHA→Copilot→merge→chain-advance loop:
 *   1. Chain config validity
 *   2. Issue state (open/closed, labels, assignees, deps)
 *   3. PR state (linked PRs, draft/ready, review status)
 *   4. GHA workflow files exist
 *   5. Copilot assignment readiness
 *   6. Chain advancement path
 *
 * Outputs a structured trace showing what each pipeline step would do.
 */
import type { Agent, AgentContext, AgentResult, AgentFinding } from '../types.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { type ChainConfig, type ChainEntry, resolveChainPath, validateChainConfig } from './chain-types.js';

// Workflow files the chain pipeline requires
const REQUIRED_WORKFLOWS = [
  'copilot-assign.yml',
  'copilot-pr-promote.yml',
  'copilot-pr-validate.yml',
  'copilot-pr-review.yml',
  'copilot-pr-merged.yml',
  'copilot-chain-advance.yml',
];

type Step = 'config' | 'workflows' | 'issues' | 'prs' | 'deps' | 'assignment' | 'path';

interface TraceEntry {
  step: Step;
  ok: boolean;
  detail: string;
}

const dryRunAgent: Agent = {
  id: 'dry-run',
  name: 'E2E Dry-Run',
  description: 'Validate full chain pipeline end-to-end without making changes',
  clusterId: 'dry-run',

  shouldRun(ctx: AgentContext): boolean {
    return !!resolveChainPath(ctx.localPath);
  },

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const findings: AgentFinding[] = [];
    const trace: TraceEntry[] = [];

    // ── Step 1: Chain config ──────────────────────────────────────────
    const chainPath = resolveChainPath(ctx.localPath);
    if (!chainPath) {
      return result('dry-run', ctx, start, 'failed', 'No chain config found', [], [
        { severity: 'error', message: 'prompt-chain.json not found in any expected location' },
      ]);
    }

    let config: ChainConfig;
    try {
      config = JSON.parse(readFileSync(chainPath, 'utf-8')) as ChainConfig;
      const errors = validateChainConfig(config);
      if (errors.length > 0) {
        errors.forEach(e => findings.push({ severity: 'error', message: `Config: ${e}` }));
        trace.push({ step: 'config', ok: false, detail: `${errors.length} validation errors` });
      } else {
        trace.push({ step: 'config', ok: true, detail: `${config.chain.length} entries, ${new Set(config.chain.map(e => e.wave)).size} waves` });
      }
    } catch (e) {
      return result('dry-run', ctx, start, 'failed', `Bad chain config: ${e}`, [], [
        { severity: 'error', message: `JSON parse failed: ${e}` },
      ]);
    }

    const [owner, repo] = config.repo.split('/') as [string, string];
    const sorted = [...config.chain].sort((a, b) => a.position - b.position);

    // ── Step 2: Workflow files ────────────────────────────────────────
    const workflowDir = join(ctx.localPath, '.github', 'workflows');
    const missing: string[] = [];
    for (const wf of REQUIRED_WORKFLOWS) {
      if (!existsSync(join(workflowDir, wf))) missing.push(wf);
    }
    if (missing.length > 0) {
      findings.push({ severity: 'error', message: `Missing workflows: ${missing.join(', ')}` });
      trace.push({ step: 'workflows', ok: false, detail: `${missing.length}/${REQUIRED_WORKFLOWS.length} missing` });
    } else {
      trace.push({ step: 'workflows', ok: true, detail: `${REQUIRED_WORKFLOWS.length} workflows present` });
    }

    // ── Step 3: Issue state ──────────────────────────────────────────
    const issueStates = new Map<number, { state: string; labels: string[]; assignees: string[] }>();
    let openCount = 0;
    let closedCount = 0;
    let noIssue = 0;

    for (const entry of sorted) {
      if (!entry.issue) { noIssue++; continue; }
      try {
        const issue = await ctx.github.getIssue(owner, repo, entry.issue);
        const labels = issue.labels.map(l => l.name);
        const assignees = issue.assignees.map(a => a.login);
        issueStates.set(entry.issue, { state: issue.state, labels, assignees });
        if (issue.state === 'open') openCount++;
        else closedCount++;

        // Flag issues with stale labels
        if (labels.includes('automation:in-progress') && issue.state === 'open') {
          findings.push({
            severity: 'warning',
            message: `#${entry.issue} (${entry.prompt}): has automation:in-progress — may block chain advancement`,
          });
        }
      } catch {
        findings.push({ severity: 'error', message: `#${entry.issue} (${entry.prompt}): issue not accessible` });
      }
    }
    trace.push({
      step: 'issues',
      ok: noIssue === 0,
      detail: `${openCount} open, ${closedCount} closed, ${noIssue} unlinked`,
    });

    // ── Step 4: PR state ─────────────────────────────────────────────
    const openPRs = await ctx.github.listPRs(owner, repo, 'open');
    const chainPRs: Array<{ pr: number; issue: number; draft: boolean; author: string }> = [];

    for (const entry of sorted) {
      if (!entry.issue) continue;
      const linked = openPRs.find(pr =>
        pr.body?.includes(`#${entry.issue}`) ||
        pr.body?.includes(`Fixes #${entry.issue}`) ||
        pr.body?.includes(`Closes #${entry.issue}`)
      );
      if (linked) {
        chainPRs.push({
          pr: linked.number,
          issue: entry.issue,
          draft: linked.draft,
          author: linked.user.login,
        });
      }
    }

    // Detect orphaned Copilot draft PRs
    const orphanDrafts = openPRs.filter(pr =>
      pr.draft && pr.user.login.toLowerCase() === 'copilot' &&
      !chainPRs.some(cp => cp.pr === pr.number)
    );
    if (orphanDrafts.length > 0) {
      findings.push({
        severity: 'warning',
        message: `${orphanDrafts.length} orphan Copilot draft PRs: ${orphanDrafts.map(p => `#${p.number}`).join(', ')}`,
      });
    }
    trace.push({
      step: 'prs',
      ok: orphanDrafts.length === 0,
      detail: `${chainPRs.length} linked PRs, ${orphanDrafts.length} orphans`,
    });

    // ── Step 5: Dependency resolution ────────────────────────────────
    const openNums = new Set(
      sorted.filter(e => e.issue && issueStates.get(e.issue)?.state === 'open').map(e => e.issue!)
    );
    let depBlockCount = 0;

    for (const entry of sorted) {
      if (!entry.issue || !openNums.has(entry.issue)) continue;
      const blockers = entry.depends
        .map(dep => sorted.find(e => e.prompt === dep))
        .filter((d): d is ChainEntry => !!d && !!d.issue && openNums.has(d.issue))
        .map(d => `${d.prompt} (#${d.issue})`);

      if (blockers.length > 0) {
        findings.push({
          severity: 'info',
          message: `#${entry.issue} (${entry.prompt}): blocked by ${blockers.join(', ')}`,
        });
        depBlockCount++;
      }
    }
    trace.push({
      step: 'deps',
      ok: true,
      detail: `${depBlockCount} entries waiting on dependencies`,
    });

    // ── Step 6: Copilot assignment readiness ─────────────────────────
    const inProgress = sorted.filter(e =>
      e.issue && issueStates.get(e.issue)?.labels.includes('automation:in-progress')
    );
    const nextCandidate = sorted.find(e => {
      if (!e.issue || !openNums.has(e.issue)) return false;
      const labels = issueStates.get(e.issue)?.labels ?? [];
      if (labels.includes('automation:in-progress') || labels.includes('automation:completed')) return false;
      // Check deps resolved
      return e.depends.every(dep => {
        const d = sorted.find(x => x.prompt === dep);
        return !d?.issue || !openNums.has(d.issue);
      });
    });

    if (inProgress.length > 0) {
      trace.push({
        step: 'assignment',
        ok: true,
        detail: `${inProgress.length} in-progress: ${inProgress.map(e => `#${e.issue} (${e.prompt})`).join(', ')}`,
      });
    } else if (nextCandidate) {
      trace.push({
        step: 'assignment',
        ok: true,
        detail: `Next: #${nextCandidate.issue} (${nextCandidate.prompt}) — ready for Copilot`,
      });
    } else if (openCount === 0) {
      trace.push({ step: 'assignment', ok: true, detail: 'Chain complete — all issues closed' });
    } else {
      findings.push({ severity: 'warning', message: 'No issue ready for assignment — all blocked on deps or labels' });
      trace.push({ step: 'assignment', ok: false, detail: 'No issue ready — blocked' });
    }

    // ── Step 7: Chain path trace ─────────────────────────────────────
    const pathLines: string[] = [];
    for (const entry of sorted) {
      const st = entry.issue ? issueStates.get(entry.issue) : null;
      const state = st?.state ?? 'no-issue';
      const labels = st?.labels?.join(',') ?? '';
      const pr = chainPRs.find(p => p.issue === entry.issue);
      const prTag = pr ? ` → PR #${pr.pr}${pr.draft ? ' (draft)' : ''}` : '';
      const marker = state === 'closed' ? '✓' :
                     labels.includes('automation:in-progress') ? '▶' :
                     entry === nextCandidate ? '◉' : '○';
      pathLines.push(`  ${marker} [${entry.position}] ${entry.prompt} #${entry.issue ?? '?'} (${state})${prTag}`);
    }
    trace.push({ step: 'path', ok: true, detail: pathLines.join('\n') });

    // ── Build output ─────────────────────────────────────────────────
    const errors = findings.filter(f => f.severity === 'error').length;
    const warnings = findings.filter(f => f.severity === 'warning').length;
    const status = errors > 0 ? 'failed' : 'success';

    const traceOutput = trace.map(t =>
      `${t.ok ? '✓' : '✗'} ${t.step}: ${t.detail}`
    ).join('\n');

    ctx.logger.info('\n── E2E Dry-Run Trace ──');
    for (const t of trace) {
      const fn = t.ok ? ctx.logger.success.bind(ctx.logger) : ctx.logger.warn.bind(ctx.logger);
      if (t.step === 'path') {
        ctx.logger.info(`Chain path:\n${t.detail}`);
      } else {
        fn(`${t.step}: ${t.detail}`);
      }
    }
    if (errors > 0 || warnings > 0) {
      ctx.logger.info(`\n${errors} errors, ${warnings} warnings`);
    }

    return result('dry-run', ctx, start, status,
      `E2E: ${errors} errors, ${warnings} warnings, ${openCount} open, ${closedCount} closed`,
      [traceOutput],
      findings,
    );
  },
};

function result(
  agentId: string, ctx: AgentContext, start: number,
  status: 'success' | 'failed' | 'skipped', message: string,
  artifacts: string[], findings: AgentFinding[],
): AgentResult {
  return { agentId, status, repo: ctx.repoAlias, duration: Date.now() - start, message, artifacts, findings };
}

export const dryRunAgents: Agent[] = [dryRunAgent];
