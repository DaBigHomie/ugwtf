/**
 * Animation & Motion Agents
 *
 * Validate animation configuration, reduced motion support,
 * and animation library usage.
 */
import type { Agent, AgentResult } from '../types.js';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Agent: Reduced Motion Checker
// ---------------------------------------------------------------------------

const reducedMotionChecker: Agent = {
  id: 'reduced-motion-checker',
  name: 'Reduced Motion Checker',
  description: 'Verify reduced motion accessibility support',
  clusterId: 'animation',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Reduced Motion: ${ctx.repoAlias}`);

    const pkgPath = join(ctx.localPath, 'package.json');
    let hasFramerMotion = false;

    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      hasFramerMotion = !!(allDeps['framer-motion'] || allDeps['motion']);
    } catch {
      // No package.json
    }

    if (!hasFramerMotion) {
      ctx.logger.info('No animation library detected — skipping');
      ctx.logger.groupEnd();
      return {
        agentId: this.id,
        status: 'success',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: 'No animation library detected',
        artifacts: [],
      };
    }

    // Check for useReducedMotion or prefers-reduced-motion
    const srcDir = join(ctx.localPath, 'src');
    let reducedMotionUsage = 0;
    let motionComponentUsage = 0;

    async function scan(dir: string): Promise<void> {
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
          await scan(full);
        } else if (/\.tsx?$/.test(entry)) {
          try {
            const content = await readFile(full, 'utf-8');
            if (/useReducedMotion|prefers-reduced-motion/i.test(content)) {
              reducedMotionUsage++;
            }
            if (/motion\.(div|span|section|button|a|img|input|li|ul|p|h[1-6])/g.test(content)) {
              motionComponentUsage++;
            }
          } catch {
            // skip
          }
        }
      }
    }

    await scan(srcDir);

    const hasSupport = reducedMotionUsage > 0;
    ctx.logger.info(
      `Motion components: ${motionComponentUsage} files, Reduced motion support: ${reducedMotionUsage} files`,
    );
    if (!hasSupport && motionComponentUsage > 0) {
      ctx.logger.warn('⚠ Animation used without reduced motion support');
    }

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: hasSupport || motionComponentUsage === 0 ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${motionComponentUsage} motion files, ${reducedMotionUsage} with reduced motion support`,
      artifacts: [],
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Animation Constants Validator
// ---------------------------------------------------------------------------

const animationConstantsValidator: Agent = {
  id: 'animation-constants-validator',
  name: 'Animation Constants Validator',
  description: 'Check for centralized animation constants',
  clusterId: 'animation',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Animation Constants: ${ctx.repoAlias}`);

    // Look for animations.ts or motion.ts config files
    const possiblePaths = [
      join(ctx.localPath, 'src', 'lib', 'animations.ts'),
      join(ctx.localPath, 'src', 'shared', 'lib', 'animations.ts'),
      join(ctx.localPath, 'src', 'lib', 'motion.ts'),
      join(ctx.localPath, 'src', 'shared', 'config', 'animations.ts'),
      join(ctx.localPath, 'lib', 'animations.ts'),
    ];

    let found: string | null = null;
    for (const p of possiblePaths) {
      if ((await stat(p).catch(() => null))?.isFile()) {
        found = p.replace(ctx.localPath + '/', '');
        break;
      }
    }

    if (found) {
      ctx.logger.info(`✅ Animation constants found: ${found}`);
    } else {
      ctx.logger.info('No centralized animation constants file');
    }

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: found ? `Animation constants: ${found}` : 'No animation constants file',
      artifacts: found ? [found] : [],
    };
  },
};

export const animationAgents: Agent[] = [reducedMotionChecker, animationConstantsValidator];
