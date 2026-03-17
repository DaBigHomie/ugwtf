/**
 * Design System & Component Agents
 *
 * Design system consistency, hardcoded color detection,
 * and component library health.
 */
import type { Agent, AgentResult } from '../types.js';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Helper: Collect files with extension
// ---------------------------------------------------------------------------

async function collectFiles(dir: string, exts: string[], maxDepth = 4, depth = 0): Promise<string[]> {
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
      results.push(...await collectFiles(fullPath, exts, maxDepth, depth + 1));
    } else if (exts.some(e => entry.endsWith(e))) {
      results.push(fullPath);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Agent: Hardcoded Color Detector
// ---------------------------------------------------------------------------

// Matches hex (#fff, #ffffff, #ffffffaa), rgb(), rgba(), hsl(), hsla()
const COLOR_PATTERNS = [
  /#[0-9a-fA-F]{3,8}\b/,
  /\brgba?\(\s*\d+/,
  /\bhsla?\(\s*\d+/,
];

// Allowlist for common non-color uses
const COLOR_ALLOWLIST = [
  '#000', '#fff', '#ffffff', '#000000',       // B&W are fine
  'transparent', 'currentColor', 'inherit',
];

const hardcodedColorDetector: Agent = {
  id: 'hardcoded-color-detector',
  name: 'Hardcoded Color Detector',
  description: 'Scan TSX/CSS files for hardcoded color values instead of theme tokens',
  clusterId: 'design',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Hardcoded Colors: ${ctx.repoAlias}`);

    const srcDir = join(ctx.localPath, 'src');
    const files = await collectFiles(srcDir, ['.tsx', '.css', '.scss']);

    const violations: string[] = [];

    for (const file of files.slice(0, 100)) { // Cap to avoid over-scanning
      try {
        const content = await readFile(file, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, i) => {
          // Skip comments and imports
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('import')) return;

          for (const pattern of COLOR_PATTERNS) {
            const match = line.match(pattern);
            if (match) {
              const value = match[0].toLowerCase();
              // Skip allowlisted values
              if (COLOR_ALLOWLIST.some(a => value.startsWith(a.toLowerCase()))) return;
              // Skip CSS variable definitions and Tailwind config
              if (line.includes('--') || file.includes('tailwind.config') || file.includes('globals.css')) return;

              const rel = file.replace(ctx.localPath + '/', '');
              violations.push(`${rel}:${i + 1}`);
              break; // One per line
            }
          }
        });
      } catch {
        // Skip unreadable
      }
    }

    ctx.logger.info(`Files scanned: ${Math.min(files.length, 100)} | Color violations: ${violations.length}`);
    if (violations.length > 0 && violations.length <= 10) {
      for (const v of violations) ctx.logger.warn(`  ⚠ ${v}`);
    } else if (violations.length > 10) {
      ctx.logger.warn(`  ⚠ ${violations.length} violations (showing first 5)`);
      for (const v of violations.slice(0, 5)) ctx.logger.warn(`    ${v}`);
    }

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: violations.length > 5 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${violations.length} hardcoded colors found`,
      artifacts: violations.slice(0, 20),
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Component Library Health
// ---------------------------------------------------------------------------

const componentLibraryScan: Agent = {
  id: 'component-library-health',
  name: 'Component Library Health',
  description: 'Check for shadcn/ui directory and component count',
  clusterId: 'design',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Component Library: ${ctx.repoAlias}`);

    const uiDirs = ['src/components/ui', 'src/shared/ui'];
    let componentCount = 0;
    let foundDir = '';

    for (const dir of uiDirs) {
      try {
        const entries = await readdir(join(ctx.localPath, dir));
        const components = entries.filter(e => /\.(tsx|ts)$/.test(e));
        if (components.length > componentCount) {
          componentCount = components.length;
          foundDir = dir;
        }
      } catch {
        // Dir doesn't exist
      }
    }

    ctx.logger.info(componentCount > 0
      ? `UI components: ${componentCount} in ${foundDir}`
      : 'No UI component directory found');

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: componentCount > 0 ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: componentCount > 0 ? `${componentCount} UI components in ${foundDir}` : 'No UI library',
      artifacts: [],
    };
  },
};

export const designAgents: Agent[] = [hardcodedColorDetector, componentLibraryScan];
