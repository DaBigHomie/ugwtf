/**
 * SEO Agents
 *
 * Meta tag validation, sitemap checks, and
 * Open Graph / social sharing validation.
 */
import type { Agent, AgentResult } from '../types.js';
import { readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Agent: Meta Tag Validator
// ---------------------------------------------------------------------------

const metaTagValidator: Agent = {
  id: 'meta-tag-validator',
  name: 'Meta Tag Validator',
  description: 'Check for essential meta tags in layout/head files',
  clusterId: 'seo',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Meta Tags: ${ctx.repoAlias}`);

    // Common layout/head file locations
    const candidates = [
      'src/index.html',
      'index.html',
      'src/app/layout.tsx',
      'app/layout.tsx',
      'src/App.tsx',
    ];

    const findings: string[] = [];
    let checked = false;

    for (const file of candidates) {
      try {
        const content = await readFile(join(ctx.localPath, file), 'utf-8');
        checked = true;

        // Check for essential meta patterns
        if (!/meta.*description/i.test(content) && !/metadata.*description/i.test(content)) {
          findings.push('Missing meta description');
        }
        if (!/meta.*viewport/i.test(content)) {
          findings.push('Missing viewport meta');
        }
        if (!/og:title|openGraph/i.test(content) && !/meta.*"og:/i.test(content)) {
          findings.push('Missing Open Graph tags');
        }

        break; // Only check first found file
      } catch {
        // File doesn't exist
      }
    }

    if (!checked) {
      ctx.logger.info('No layout/head files found');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: 'No layout files', artifacts: [] };
    }

    ctx.logger.info(`Meta issues: ${findings.length}`);
    for (const f of findings) ctx.logger.warn(`  ❌ ${f}`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: findings.length > 0 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: findings.length > 0 ? findings.join(', ') : 'Meta tags OK',
      artifacts: findings,
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Sitemap & Robots Checker
// ---------------------------------------------------------------------------

const sitemapChecker: Agent = {
  id: 'sitemap-checker',
  name: 'Sitemap & Robots Checker',
  description: 'Check for sitemap.xml and robots.txt presence',
  clusterId: 'seo',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Sitemap/Robots: ${ctx.repoAlias}`);

    const seoFiles = [
      { path: 'public/sitemap.xml', label: 'sitemap.xml' },
      { path: 'public/robots.txt', label: 'robots.txt' },
      { path: 'src/app/sitemap.ts', label: 'sitemap.ts (Next.js)' },
      { path: 'src/app/robots.ts', label: 'robots.ts (Next.js)' },
    ];

    const found: string[] = [];

    for (const file of seoFiles) {
      try {
        await access(join(ctx.localPath, file.path));
        found.push(file.label);
      } catch {
        // Not found
      }
    }

    const hasSitemap = found.some(f => f.includes('sitemap'));
    const hasRobots = found.some(f => f.includes('robots'));

    ctx.logger.info(`SEO files: ${found.join(', ') || 'none'}`);
    if (!hasSitemap) ctx.logger.warn('  ❌ No sitemap.xml');
    if (!hasRobots) ctx.logger.warn('  ❌ No robots.txt');

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: hasSitemap && hasRobots ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: found.length > 0 ? `Found: ${found.join(', ')}` : 'No SEO files',
      artifacts: [
        ...(!hasSitemap ? ['missing:sitemap'] : []),
        ...(!hasRobots ? ['missing:robots'] : []),
      ],
    };
  },
};

export const seoAgents: Agent[] = [metaTagValidator, sitemapChecker];
