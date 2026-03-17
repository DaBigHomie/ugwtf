/**
 * DevOps & CI/CD Agents
 *
 * Validates GitHub Actions workflows, deployment readiness,
 * and build configuration consistency.
 */
import type { Agent, AgentResult } from '../types.js';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Agent: Workflow Syntax Validator
// ---------------------------------------------------------------------------

const workflowSyntaxValidator: Agent = {
  id: 'workflow-syntax-validator',
  name: 'Workflow Syntax Validator',
  description: 'Check workflow YAML for ${{ }} in comments and structural issues',
  clusterId: 'devops',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Workflow Syntax: ${ctx.repoAlias}`);

    const workflowDir = join(ctx.localPath, '.github', 'workflows');
    let files: string[];

    try {
      files = (await readdir(workflowDir)).filter(f => /\.ya?ml$/.test(f));
    } catch {
      ctx.logger.info('No .github/workflows/ directory');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: 'No workflows dir', artifacts: [] };
    }

    const issues: string[] = [];

    for (const file of files) {
      try {
        const content = await readFile(join(workflowDir, file), 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, i) => {
          const trimmed = line.trimStart();
          // Check for ${{ }} in comments — causes GitHub Actions parse errors
          if (trimmed.startsWith('#') && /\$\{\{.*\}\}/.test(line)) {
            issues.push(`${file}:${i + 1} — $\{{ }} in comment`);
          }
        });
      } catch {
        // Skip unreadable
      }
    }

    ctx.logger.info(`Workflows: ${files.length} | Syntax issues: ${issues.length}`);
    for (const issue of issues) {
      ctx.logger.warn(`  ⚠ ${issue}`);
    }

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: issues.length > 0 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${files.length} workflows, ${issues.length} syntax issues`,
      artifacts: issues,
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Build Config Validator
// ---------------------------------------------------------------------------

const buildConfigValidator: Agent = {
  id: 'build-config-validator',
  name: 'Build Config Validator',
  description: 'Verify presence and consistency of build configuration files',
  clusterId: 'devops',

  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Build Config: ${ctx.repoAlias}`);

    const requiredFiles = ['package.json', 'tsconfig.json'];
    const missing: string[] = [];

    for (const f of requiredFiles) {
      try {
        await readFile(join(ctx.localPath, f), 'utf-8');
      } catch {
        missing.push(f);
      }
    }

    // Check package.json scripts
    let hasBuiltScript = false;
    let hasLintScript = false;

    try {
      const pkgRaw = await readFile(join(ctx.localPath, 'package.json'), 'utf-8');
      const pkg = JSON.parse(pkgRaw);
      hasBuiltScript = !!pkg.scripts?.build;
      hasLintScript = !!pkg.scripts?.lint;

      if (!hasBuiltScript) ctx.logger.warn('Missing "build" script in package.json');
      if (!hasLintScript) ctx.logger.warn('Missing "lint" script in package.json');
    } catch {
      // Already counted in missing
    }

    ctx.logger.info(`Missing config files: ${missing.length} | Build script: ${hasBuiltScript} | Lint script: ${hasLintScript}`);
    ctx.logger.groupEnd();

    const hasIssues = missing.length > 0 || !hasBuiltScript;

    return {
      agentId: this.id,
      status: hasIssues ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: hasIssues ? `Missing: ${[...missing, !hasBuiltScript ? 'build script' : ''].filter(Boolean).join(', ')}` : 'All configs present',
      artifacts: missing,
    };
  },
};

export const devopsAgents: Agent[] = [workflowSyntaxValidator, buildConfigValidator];
