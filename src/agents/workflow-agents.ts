/**
 * Workflow Deployment Agents
 *
 * Real execution: generates workflow YAML and writes to repo .github/workflows/.
 * Handles CI, Copilot automation, security audit, and dependabot workflows.
 */
import type { Agent, AgentContext, AgentResult } from '../types.js';
import { getRepo } from '../config/repo-registry.js';
import { generateCI } from '../generators/ci-workflow.js';
import { generateCopilotFullAutomation } from '../generators/copilot-automation.js';
import { generateSecurityAudit } from '../generators/security-audit.js';
import { generateDependabotAutoMerge } from '../generators/dependabot-auto-merge.js';
import { generateSupabaseMigration } from '../generators/supabase-migration.js';
import { generateVisualAudit } from '../generators/visual-audit.js';
import { writeFile, repoPath } from '../utils/fs.js';

interface WorkflowSpec {
  filename: string;
  generator: (repo: import('../config/repo-registry.js').RepoConfig) => string;
  /** Only generate if this returns true */
  condition?: (repo: import('../config/repo-registry.js').RepoConfig) => boolean;
}

const WORKFLOW_SPECS: WorkflowSpec[] = [
  { filename: 'ci.yml', generator: generateCI },
  { filename: 'copilot-full-automation.yml', generator: generateCopilotFullAutomation },
  { filename: 'security-audit.yml', generator: generateSecurityAudit },
  { filename: 'dependabot-auto-merge.yml', generator: generateDependabotAutoMerge },
  {
    filename: 'supabase-migration-automation.yml',
    generator: generateSupabaseMigration,
    condition: (repo) => repo.supabaseProjectId !== null,
  },
  { filename: 'visual-audit.yml', generator: generateVisualAudit },
];

function makeDeployAgent(spec: WorkflowSpec): Agent {
  return {
    id: `workflow-deploy-${spec.filename.replace('.yml', '')}`,
    name: `Deploy ${spec.filename}`,
    description: `Generate and write ${spec.filename} to .github/workflows/`,
    clusterId: 'workflows',

    shouldRun(ctx) {
      const repo = getRepo(ctx.repoAlias);
      if (!repo) return false;
      return spec.condition ? spec.condition(repo) : true;
    },

    async execute(ctx): Promise<AgentResult> {
      const start = Date.now();
      const repo = getRepo(ctx.repoAlias);
      if (!repo) {
        return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: 0, message: 'No config', artifacts: [] };
      }

      const yaml = spec.generator(repo);
      const dest = repoPath(repo, '.github', 'workflows', spec.filename);

      if (ctx.dryRun) {
        ctx.logger.info(`[DRY RUN] Would write ${dest} (${yaml.length} bytes)`);
        return { agentId: this.id, status: 'success', repo: ctx.repoAlias, duration: Date.now() - start, message: `DRY RUN: ${spec.filename}`, artifacts: [dest] };
      }

      const result = writeFile(dest, yaml);
      ctx.logger.success(`${result.action}: ${spec.filename}`);
      return { agentId: this.id, status: 'success', repo: ctx.repoAlias, duration: Date.now() - start, message: `${result.action}: ${spec.filename}`, artifacts: [dest] };
    },
  };
}

const validateWorkflowsAgent: Agent = {
  id: 'workflow-validate',
  name: 'Validate Deployed Workflows',
  description: 'Check that all expected workflow files exist and are up to date',
  clusterId: 'workflows',

  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    const repo = getRepo(ctx.repoAlias);
    if (!repo) {
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: 0, message: 'No config', artifacts: [] };
    }

    const { existsSync, readFileSync } = await import('node:fs');
    const missing: string[] = [];
    const drifted: string[] = [];
    const ok: string[] = [];

    for (const spec of WORKFLOW_SPECS) {
      if (spec.condition && !spec.condition(repo)) continue;

      const dest = repoPath(repo, '.github', 'workflows', spec.filename);
      if (!existsSync(dest)) {
        missing.push(spec.filename);
        continue;
      }

      const current = readFileSync(dest, 'utf-8');
      const expected = spec.generator(repo);
      if (current !== expected) {
        drifted.push(spec.filename);
      } else {
        ok.push(spec.filename);
      }
    }

    const status = missing.length > 0 || drifted.length > 0 ? 'failed' : 'success';
    return {
      agentId: this.id,
      status,
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `OK: ${ok.length}, Missing: ${missing.length}, Drifted: ${drifted.length}`,
      artifacts: [...missing.map(f => `MISSING: ${f}`), ...drifted.map(f => `DRIFTED: ${f}`)],
    };
  },
};

export const workflowAgents: Agent[] = [
  ...WORKFLOW_SPECS.map(makeDeployAgent),
  validateWorkflowsAgent,
];
