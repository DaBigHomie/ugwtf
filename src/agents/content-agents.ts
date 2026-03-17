/**
 * Content & CMS Agents
 *
 * Static content validation, image optimization checks,
 * and content freshness tracking.
 */
import type { Agent, AgentResult } from '../types.js';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Agent: Image Optimization Checker
// ---------------------------------------------------------------------------

const imageOptimizationChecker: Agent = {
  id: 'image-optimization-checker',
  name: 'Image Optimization Checker',
  description: 'Check for oversized images in public directory',
  clusterId: 'content',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Image Optimization: ${ctx.repoAlias}`);

    const publicDir = join(ctx.localPath, 'public');
    const oversized: string[] = [];
    const MAX_SIZE = 500_000; // 500KB

    async function scanDir(dir: string): Promise<void> {
      let entries: string[];
      try {
        entries = await readdir(dir);
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const s = await stat(fullPath).catch(() => null);
        if (!s) continue;

        if (s.isDirectory()) {
          await scanDir(fullPath);
        } else if (/\.(png|jpg|jpeg|gif|bmp|tiff|webp|svg)$/i.test(entry)) {
          if (s.size > MAX_SIZE) {
            const rel = fullPath.replace(ctx.localPath + '/', '');
            const sizeMb = (s.size / 1024 / 1024).toFixed(1);
            oversized.push(`${rel} (${sizeMb}MB)`);
          }
        }
      }
    }

    await scanDir(publicDir);

    ctx.logger.info(`Oversized images (>500KB): ${oversized.length}`);
    for (const o of oversized.slice(0, 5)) ctx.logger.warn(`  ⚠ ${o}`);

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: oversized.length > 3 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${oversized.length} oversized images`,
      artifacts: oversized.slice(0, 20),
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Static Asset Counter
// ---------------------------------------------------------------------------

const staticAssetCounter: Agent = {
  id: 'static-asset-counter',
  name: 'Static Asset Counter',
  description: 'Inventory static assets in public directory',
  clusterId: 'content',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Static Assets: ${ctx.repoAlias}`);

    const publicDir = join(ctx.localPath, 'public');
    const counts: Record<string, number> = {};
    let total = 0;

    async function scanDir(dir: string): Promise<void> {
      let entries: string[];
      try {
        entries = await readdir(dir);
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const s = await stat(fullPath).catch(() => null);
        if (!s) continue;

        if (s.isDirectory()) {
          await scanDir(fullPath);
        } else {
          const ext = entry.split('.').pop()?.toLowerCase() ?? 'unknown';
          counts[ext] = (counts[ext] ?? 0) + 1;
          total++;
        }
      }
    }

    await scanDir(publicDir);

    const summary = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([ext, count]) => `${ext}: ${count}`)
      .slice(0, 10)
      .join(', ');

    ctx.logger.info(`Total assets: ${total} | ${summary}`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${total} assets (${summary})`,
      artifacts: [],
    };
  },
};

export const contentAgents: Agent[] = [imageOptimizationChecker, staticAssetCounter];
