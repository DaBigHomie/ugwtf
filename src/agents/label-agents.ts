/**
 * Label Sync Agents
 *
 * Real execution: calls GitHub API to create/update labels on repos.
 * Handles UNIVERSAL_LABELS + repo.extraLabels per config.
 */
import type { Agent, AgentContext, AgentResult } from '../types.js';
import { UNIVERSAL_LABELS, getRepo } from '../config/repo-registry.js';

function parseSlug(slug: string): { owner: string; repo: string } {
  const parts = slug.split('/');
  return { owner: parts[0]!, repo: parts[1]! };
}

const syncLabelsAgent: Agent = {
  id: 'label-sync',
  name: 'Label Sync',
  description: 'Sync all universal + repo-specific labels to GitHub',
  clusterId: 'labels',

  shouldRun(_ctx) {
    return true; // Every repo needs labels
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    const artifacts: string[] = [];
    const repoConfig = getRepo(ctx.repoAlias);

    if (!repoConfig) {
      return {
        agentId: this.id,
        status: 'failed',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: `Repo config not found: ${ctx.repoAlias}`,
        artifacts: [],
        error: 'Missing repo config',
      };
    }

    const { owner, repo } = parseSlug(repoConfig.slug);
    const allLabels = [...UNIVERSAL_LABELS, ...repoConfig.extraLabels];

    ctx.logger.group(`Syncing ${allLabels.length} labels → ${repoConfig.slug}`);

    let created = 0;
    let updated = 0;
    let errors = 0;

    // Get existing labels to determine create vs update
    let existingLabels: Array<{ name: string; color: string; description: string }> = [];
    try {
      existingLabels = await ctx.github.listLabels(owner, repo);
    } catch (err) {
      ctx.logger.warn(`Could not fetch existing labels: ${err}`);
    }

    const existingNames = new Set(existingLabels.map(l => l.name));

    for (const label of allLabels) {
      try {
        await ctx.github.syncLabel(owner, repo, label);
        if (existingNames.has(label.name)) {
          updated++;
        } else {
          created++;
        }
        artifacts.push(label.name);
        ctx.logger.success(`${label.name}`);
      } catch (err) {
        errors++;
        ctx.logger.error(`Failed: ${label.name} — ${err}`);
      }
    }

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: errors > 0 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Labels: ${created} created, ${updated} updated, ${errors} errors`,
      artifacts,
    };
  },
};

const auditLabelsAgent: Agent = {
  id: 'label-audit',
  name: 'Label Audit',
  description: 'Report label drift — missing, extra, or wrong color/description',
  clusterId: 'labels',

  shouldRun(_ctx) {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    const repoConfig = getRepo(ctx.repoAlias);
    if (!repoConfig) {
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: 0, message: 'No config', artifacts: [] };
    }

    const { owner, repo } = parseSlug(repoConfig.slug);
    const expected = [...UNIVERSAL_LABELS, ...repoConfig.extraLabels];

    let existing: Array<{ name: string; color: string; description: string }> = [];
    try {
      existing = await ctx.github.listLabels(owner, repo);
    } catch {
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: Date.now() - start, message: 'Cannot fetch labels', artifacts: [] };
    }

    const existingMap = new Map(existing.map(l => [l.name, l]));
    const missing: string[] = [];
    const drifted: string[] = [];

    for (const label of expected) {
      const found = existingMap.get(label.name);
      if (!found) {
        missing.push(label.name);
      } else if (found.color !== label.color || found.description !== label.description) {
        drifted.push(label.name);
      }
    }

    const extra = existing.filter(l => !expected.some(e => e.name === l.name)).map(l => l.name);

    const artifacts = [...missing.map(n => `MISSING: ${n}`), ...drifted.map(n => `DRIFTED: ${n}`), ...extra.map(n => `EXTRA: ${n}`)];

    return {
      agentId: this.id,
      status: missing.length > 0 || drifted.length > 0 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Missing: ${missing.length}, Drifted: ${drifted.length}, Extra: ${extra.length}`,
      artifacts,
    };
  },
};

export const labelAgents: Agent[] = [syncLabelsAgent, auditLabelsAgent];
