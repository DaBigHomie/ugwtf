/**
 * Accessibility Agents
 *
 * Basic static analysis for accessibility patterns:
 * alt text, aria labels, focus management.
 */
import type { Agent, AgentResult } from '../types.js';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Helper: Collect TSX files
// ---------------------------------------------------------------------------

async function collectTsx(dir: string, maxDepth = 4, depth = 0): Promise<string[]> {
  if (depth > maxDepth) return [];
  const results: string[] = [];

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === '.next') continue;

    const fullPath = join(dir, entry);
    const s = await stat(fullPath).catch(() => null);
    if (!s) continue;

    if (s.isDirectory()) {
      results.push(...await collectTsx(fullPath, maxDepth, depth + 1));
    } else if (entry.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Agent: Alt Text Checker
// ---------------------------------------------------------------------------

const altTextChecker: Agent = {
  id: 'alt-text-checker',
  name: 'Alt Text Checker',
  description: 'Scan JSX for images without alt attributes',
  clusterId: 'a11y',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Alt Text: ${ctx.repoAlias}`);

    const srcDir = join(ctx.localPath, 'src');
    const files = await collectTsx(srcDir);

    const violations: string[] = [];

    for (const file of files.slice(0, 80)) {
      try {
        const content = await readFile(file, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, i) => {
          // Check for <img without alt
          if (/<img\s/i.test(line) && !/alt\s*=/i.test(line)) {
            // Might span multiple lines — check next 3 lines
            const snippet = lines.slice(i, i + 4).join(' ');
            if (!/alt\s*=/i.test(snippet)) {
              const rel = file.replace(ctx.localPath + '/', '');
              violations.push(`${rel}:${i + 1}`);
            }
          }

          // Check for Image (Next.js) without alt
          if (/<Image\s/i.test(line) && !/alt\s*=/i.test(line)) {
            const snippet = lines.slice(i, i + 4).join(' ');
            if (!/alt\s*=/i.test(snippet)) {
              const rel = file.replace(ctx.localPath + '/', '');
              violations.push(`${rel}:${i + 1}`);
            }
          }
        });
      } catch {
        // Skip
      }
    }

    ctx.logger.info(`Files checked: ${Math.min(files.length, 80)} | Missing alt: ${violations.length}`);
    for (const v of violations.slice(0, 5)) ctx.logger.warn(`  ⚠ ${v}`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: violations.length > 3 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${violations.length} images missing alt text`,
      artifacts: violations.slice(0, 20),
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: ARIA Label Checker
// ---------------------------------------------------------------------------

const ariaLabelChecker: Agent = {
  id: 'aria-label-checker',
  name: 'ARIA Label Checker',
  description: 'Check interactive elements for aria-label or accessible names',
  clusterId: 'a11y',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`ARIA Labels: ${ctx.repoAlias}`);

    const srcDir = join(ctx.localPath, 'src');
    const files = await collectTsx(srcDir);

    const violations: string[] = [];

    for (const file of files.slice(0, 80)) {
      try {
        const content = await readFile(file, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, i) => {
          // Check for icon-only buttons (button with no text content, just an icon)
          if (/<button/i.test(line) || /<Button/i.test(line)) {
            const snippet = lines.slice(i, i + 3).join(' ');
            // Has an icon component/element but no aria-label
            if (/Icon|<svg|<i\s/i.test(snippet) && !/aria-label/i.test(snippet)) {
              // Check if there's visible text content
              const hasText = new RegExp('>[^<]+<').test(snippet);
              const isEmpty = new RegExp('>\\s*<').test(snippet);
              if (!hasText || isEmpty) {
                const rel = file.replace(ctx.localPath + '/', '');
                violations.push(`${rel}:${i + 1}`);
              }
            }
          }
        });
      } catch {
        // Skip
      }
    }

    ctx.logger.info(`Icon buttons missing aria-label: ${violations.length}`);
    for (const v of violations.slice(0, 5)) ctx.logger.warn(`  ⚠ ${v}`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: violations.length > 5 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${violations.length} interactive elements missing aria-label`,
      artifacts: violations.slice(0, 20),
    };
  },
};

export const a11yAgents: Agent[] = [altTextChecker, ariaLabelChecker];
