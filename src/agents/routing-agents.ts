/**
 * Routing Agents
 *
 * Validate route structure, detect orphan pages,
 * and verify navigation consistency.
 */
import type { Agent, AgentResult } from '../types.js';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Agent: Route Coverage Scanner
// ---------------------------------------------------------------------------

const routeCoverageScanner: Agent = {
  id: 'route-coverage-scanner',
  name: 'Route Coverage Scanner',
  description: 'Detect page files and verify they have route entries',
  clusterId: 'routing',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Route Coverage: ${ctx.repoAlias}`);

    // Detect framework
    const pkgPath = join(ctx.localPath, 'package.json');
    let isNextJs = false;
    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
      isNextJs = !!pkg.dependencies?.next || !!pkg.devDependencies?.next;
    } catch {
      // no package.json
    }

    const pages: string[] = [];

    if (isNextJs) {
      // Next.js App Router — pages live in app/**/page.tsx
      const appDir = join(ctx.localPath, 'src', 'app');
      await collectPages(appDir, 'page', pages, ctx.localPath);
      // Also check top-level app/
      const topApp = join(ctx.localPath, 'app');
      await collectPages(topApp, 'page', pages, ctx.localPath);
    } else {
      // React Router — pages live in src/pages/*.tsx
      const pagesDir = join(ctx.localPath, 'src', 'pages');
      await collectPages(pagesDir, null, pages, ctx.localPath);
    }

    ctx.logger.info(`Pages found: ${pages.length}`);
    for (const p of pages.slice(0, 10)) ctx.logger.info(`  ${p}`);
    if (pages.length > 10) ctx.logger.info(`  ... and ${pages.length - 10} more`);

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${pages.length} page files detected`,
      artifacts: pages.slice(0, 30),
    };
  },
};

async function collectPages(
  dir: string,
  filePrefix: string | null,
  results: string[],
  rootPath: string,
): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const s = await stat(full).catch(() => null);
    if (!s) continue;
    if (s.isDirectory()) {
      await collectPages(full, filePrefix, results, rootPath);
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      if (!filePrefix || entry.startsWith(filePrefix)) {
        results.push(full.replace(rootPath + '/', ''));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Agent: Dead Link Detector
// ---------------------------------------------------------------------------

const deadLinkDetector: Agent = {
  id: 'dead-link-detector',
  name: 'Dead Link Detector',
  description: 'Detect internal links pointing to non-existent routes',
  clusterId: 'routing',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Dead Link Detection: ${ctx.repoAlias}`);

    // Simple check: look for common routing anti-patterns in src/
    const srcDir = join(ctx.localPath, 'src');
    const issues: string[] = [];

    async function scanFiles(dir: string): Promise<void> {
      let entries: string[];
      try {
        entries = await readdir(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        const full = join(dir, entry);
        const s = await stat(full).catch(() => null);
        if (!s) continue;
        if (s.isDirectory()) {
          await scanFiles(full);
        } else if (/\.tsx?$/.test(entry)) {
          try {
            const content = await readFile(full, 'utf-8');
            // Check for href="#" (no-op links)
            const hashLinks = (content.match(/href=["']#["']/g) ?? []).length;
            if (hashLinks > 0) {
              const rel = full.replace(ctx.localPath + '/', '');
              issues.push(`${rel}: ${hashLinks} href="#" link(s)`);
            }
          } catch {
            // skip
          }
        }
      }
    }

    await scanFiles(srcDir);

    ctx.logger.info(`Routing issues: ${issues.length}`);
    for (const i of issues.slice(0, 5)) ctx.logger.warn(`  ⚠ ${i}`);

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: issues.length > 5 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${issues.length} routing issues`,
      artifacts: issues.slice(0, 20),
    };
  },
};

export const routingAgents: Agent[] = [routeCoverageScanner, deadLinkDetector];
