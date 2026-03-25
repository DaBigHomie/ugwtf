/**
 * Instruction Sync Agent
 *
 * Syncs UGWTF instruction docs (source of truth) to target repos.
 * Each doc in SYNC_MAPPINGS is written to .github/instructions/ with applyTo frontmatter.
 */
import type { Agent, AgentResult } from '../types.js';
import { getRepo } from '../config/repo-registry.js';
import { writeFile, repoPath } from '../utils/fs.js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = resolve(__dirname, '../../docs');
const FRONTMATTER = `---\napplyTo: "**"\n---\n\n`;

/** Source doc (relative to docs/) → target path (relative to repo root) */
const SYNC_MAPPINGS: Array<{ source: string; target: string }> = [
  { source: 'agent-reference.md', target: '.github/instructions/ugwtf-workflow.instructions.md' },
  { source: 'ci-instructions.md', target: '.github/instructions/ci-instructions.md' },
  { source: 'chain-instructions.md', target: '.github/instructions/chain-instructions.md' },
];

export const instructionSyncAgent: Agent = {
  id: 'instruction-sync',
  name: 'Sync UGWTF Instructions',
  description: 'Copy instruction docs from UGWTF to target repo .github/instructions/',
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

    const artifacts: string[] = [];
    const messages: string[] = [];

    for (const mapping of SYNC_MAPPINGS) {
      const sourcePath = resolve(DOCS_DIR, mapping.source);

      let sourceContent: string;
      try {
        sourceContent = readFileSync(sourcePath, 'utf-8');
      } catch {
        ctx.logger.warn(`Cannot read docs/${mapping.source} — skipping`);
        continue;
      }

      // Strip any existing frontmatter from source, prepend target frontmatter
      const contentWithoutFrontmatter = sourceContent.replace(/^---[\s\S]*?---\s*\n/, '');
      const output = FRONTMATTER + contentWithoutFrontmatter;

      const dest = repoPath(repo, mapping.target);

      if (ctx.dryRun) {
        ctx.logger.info(`[DRY RUN] Would write ${dest} (${output.length} bytes)`);
        messages.push(`DRY RUN: ${mapping.target}`);
        artifacts.push(dest);
        continue;
      }

      const result = writeFile(dest, output);
      ctx.logger.success(`${result.action}: ${mapping.target}`);
      messages.push(`${result.action}: ${mapping.target}`);
      artifacts.push(dest);
    }

    return {
      agentId: this.id,
      status: artifacts.length > 0 ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: messages.join('; '),
      artifacts,
    };
  },
};
