/**
 * State Management Agents
 *
 * Verify state management patterns, detect
 * anti-patterns, and validate store architecture.
 */
import type { Agent, AgentResult } from '../types.js';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Agent: State Pattern Detector
// ---------------------------------------------------------------------------

const statePatternDetector: Agent = {
  id: 'state-pattern-detector',
  name: 'State Pattern Detector',
  description: 'Detect state management libraries and patterns',
  clusterId: 'state',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`State Patterns: ${ctx.repoAlias}`);

    const pkgPath = join(ctx.localPath, 'package.json');
    const patterns: string[] = [];

    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      const stateLibs: Record<string, string> = {
        zustand: 'Zustand',
        redux: 'Redux',
        '@reduxjs/toolkit': 'Redux Toolkit',
        recoil: 'Recoil',
        jotai: 'Jotai',
        valtio: 'Valtio',
        mobx: 'MobX',
        '@tanstack/react-query': 'React Query',
        'react-query': 'React Query (legacy)',
        swr: 'SWR',
      };

      for (const [dep, label] of Object.entries(stateLibs)) {
        if (allDeps[dep]) {
          patterns.push(`${label} (${allDeps[dep]})`);
        }
      }

      // Check for React Context usage
      const srcDir = join(ctx.localPath, 'src');
      const contextCount = await countPattern(srcDir, /createContext\s*[<(]/g);
      if (contextCount > 0) {
        patterns.push(`React Context (${contextCount} contexts)`);
      }
    } catch {
      ctx.logger.warn('Could not read package.json');
    }

    ctx.logger.info(`State management: ${patterns.join(', ') || 'None detected'}`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: patterns.length > 0 ? patterns.join(', ') : 'No state management detected',
      artifacts: patterns,
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Prop Drilling Detector
// ---------------------------------------------------------------------------

const propDrillingDetector: Agent = {
  id: 'prop-drilling-detector',
  name: 'Prop Drilling Detector',
  description: 'Detect potential prop drilling patterns',
  clusterId: 'state',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Prop Drilling: ${ctx.repoAlias}`);

    const srcDir = join(ctx.localPath, 'src');
    const warnings: string[] = [];

    // Heuristic: components with >8 props may indicate prop drilling
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
        } else if (/\.tsx$/.test(entry)) {
          try {
            const content = await readFile(full, 'utf-8');
            // Look for interface/type with many props
            const propsMatch = content.match(/(?:interface|type)\s+\w*Props\s*(?:=\s*)?\{([^}]{400,})\}/);
            if (propsMatch?.[1]) {
              const propCount = (propsMatch[1].match(/\w+\s*[?:]?\s*:/g) ?? []).length;
              if (propCount > 8) {
                const rel = full.replace(ctx.localPath + '/', '');
                warnings.push(`${rel}: ${propCount} props (potential drilling)`);
              }
            }
          } catch {
            // skip
          }
        }
      }
    }

    await scan(srcDir);

    ctx.logger.info(`Potential prop drilling: ${warnings.length} files`);
    for (const w of warnings.slice(0, 5)) ctx.logger.warn(`  ⚠ ${w}`);

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${warnings.length} potential prop drilling cases`,
      artifacts: warnings.slice(0, 20),
    };
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function countPattern(dir: string, pattern: RegExp): Promise<number> {
  let count = 0;
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const s = await stat(full).catch(() => null);
    if (!s) continue;
    if (s.isDirectory()) {
      count += await countPattern(full, pattern);
    } else if (/\.tsx?$/.test(entry)) {
      try {
        const content = await readFile(full, 'utf-8');
        count += (content.match(pattern) ?? []).length;
      } catch {
        // skip
      }
    }
  }
  return count;
}

export const stateAgents: Agent[] = [statePatternDetector, propDrillingDetector];
