/**
 * Context & Handoff Agents
 *
 * Validates agent-to-agent handoff documentation,
 * instruction file coverage, and session memory integrity.
 */
import type { Agent, AgentResult } from '../types.js';
import { readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Agent: Instruction File Coverage
// ---------------------------------------------------------------------------

const instructionFileCoverage: Agent = {
  id: 'instruction-file-coverage',
  name: 'Instruction File Coverage',
  description: 'Verify presence and completeness of agent instruction files',
  clusterId: 'context',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Instruction Coverage: ${ctx.repoAlias}`);

    const checks = [
      { path: '.github/copilot-instructions.md', label: 'copilot-instructions.md', required: true },
      { path: 'AGENTS.md', label: 'AGENTS.md', required: true },
      { path: '.github/instructions', label: '.github/instructions/', required: false },
      { path: '.github/prompts', label: '.github/prompts/', required: false },
    ];

    const found: string[] = [];
    const missing: string[] = [];
    let instructionCount = 0;

    for (const check of checks) {
      try {
        const fullPath = join(ctx.localPath, check.path);
        await access(fullPath);
        found.push(check.label);

        // Count instruction files if it's a directory
        if (check.path.endsWith('/') || check.path === '.github/instructions') {
          try {
            const files = await readdir(fullPath);
            instructionCount = files.filter(f => f.endsWith('.instructions.md')).length;
          } catch {
            // Not a directory
          }
        }
      } catch {
        if (check.required) missing.push(check.label);
      }
    }

    // Validate copilot-instructions.md has minimum content
    try {
      const content = await readFile(join(ctx.localPath, '.github/copilot-instructions.md'), 'utf-8');
      const lineCount = content.split('\n').length;
      if (lineCount < 30) {
        missing.push('copilot-instructions.md too short (<30 lines)');
      }
    } catch {
      // Already counted
    }

    ctx.logger.info(`Found: ${found.join(', ')} | Instructions: ${instructionCount}`);
    if (missing.length > 0) {
      for (const m of missing) ctx.logger.warn(`  ❌ ${m}`);
    }
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: missing.length > 0 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Docs: ${found.length} present | Instructions: ${instructionCount} | Missing: ${missing.length}`,
      artifacts: missing,
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Handoff Doc Validator
// ---------------------------------------------------------------------------

const handoffDocValidator: Agent = {
  id: 'handoff-doc-validator',
  name: 'Handoff Doc Validator',
  description: 'Check for handoff documentation quality and freshness',
  clusterId: 'context',
  shouldRun(ctx) {
    // Only repos that are likely to need handoff docs
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Handoff Docs: ${ctx.repoAlias}`);

    const handoffDirs = ['docs/handoff', 'docs'];
    let handoffFiles: string[] = [];
    let handoffDir = '';

    for (const dir of handoffDirs) {
      try {
        const entries = await readdir(join(ctx.localPath, dir));
        const mdFiles = entries.filter(f => f.endsWith('.md'));
        if (mdFiles.length > handoffFiles.length) {
          handoffFiles = mdFiles;
          handoffDir = dir;
        }
      } catch {
        // Dir doesn't exist
      }
    }

    ctx.logger.info(handoffFiles.length > 0
      ? `Found ${handoffFiles.length} doc files in ${handoffDir}`
      : 'No docs directory found');

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: handoffFiles.length >= 3 ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: handoffFiles.length > 0 ? `${handoffFiles.length} docs in ${handoffDir}` : 'No docs found',
      artifacts: [],
    };
  },
};

export const contextAgents: Agent[] = [instructionFileCoverage, handoffDocValidator];
