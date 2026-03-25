/**
 * Instruction Sync Agent
 *
 * Syncs the UGWTF agent-reference doc (source of truth) to target repos.
 * Writes to .github/instructions/ugwtf-workflow.instructions.md
 */
import type { Agent, AgentResult } from '../types.js';
import { getRepo } from '../config/repo-registry.js';
import { writeFile, repoPath } from '../utils/fs.js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DOC = resolve(__dirname, '../../docs/agent-reference.md');
const FRONTMATTER = `---\napplyTo: "**"\n---\n\n`;
const TARGET_PATH = '.github/instructions/ugwtf-workflow.instructions.md';

export const instructionSyncAgent: Agent = {
  id: 'instruction-sync',
  name: 'Sync UGWTF Instructions',
  description: 'Copy agent-reference.md from UGWTF to target repo instructions',
  clusterId: 'workflows',

  shouldRun(ctx) {
    const repo = getRepo(ctx.repoAlias);
    // Don't sync to UGWTF itself
    return !!repo && ctx.repoAlias !== 'ugwtf';
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    const repo = getRepo(ctx.repoAlias);
    if (!repo) {
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: 0, message: 'No config', artifacts: [] };
    }

    let sourceContent: string;
    try {
      sourceContent = readFileSync(SOURCE_DOC, 'utf-8');
    } catch {
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: Date.now() - start, message: 'Cannot read docs/agent-reference.md', artifacts: [] };
    }

    // Strip any existing frontmatter from source, prepend target frontmatter
    const contentWithoutFrontmatter = sourceContent.replace(/^---[\s\S]*?---\s*\n/, '');
    const output = FRONTMATTER + contentWithoutFrontmatter;

    const dest = repoPath(repo, TARGET_PATH);

    if (ctx.dryRun) {
      ctx.logger.info(`[DRY RUN] Would write ${dest} (${output.length} bytes)`);
      return { agentId: this.id, status: 'success', repo: ctx.repoAlias, duration: Date.now() - start, message: `DRY RUN: ${TARGET_PATH}`, artifacts: [dest] };
    }

    const result = writeFile(dest, output);
    ctx.logger.success(`${result.action}: ${TARGET_PATH}`);
    return { agentId: this.id, status: 'success', repo: ctx.repoAlias, duration: Date.now() - start, message: `${result.action}: ${TARGET_PATH}`, artifacts: [dest] };
  },
};
