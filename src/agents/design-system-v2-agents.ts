/**
 * Design System V2 Agents — "Stitch" Engine
 *
 * Inspired by maximus-ai C06 (Design Bridge / Stitch — visual-to-AST, prop definition,
 * state synthesis, responsive constraint translation) and C08 (design-token-sync,
 * component-prop-auditor). Shares front-end interface requirements across the system.
 */
import type { Agent, AgentResult } from '../types.js';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function collectFiles(dir: string, exts: string[], maxDepth = 4, depth = 0): Promise<string[]> {
  if (depth > maxDepth) return [];
  const results: string[] = [];
  let entries: string[];
  try { entries = await readdir(dir); } catch { return results; }
  for (const entry of entries) {
    if (['node_modules', '.git', 'dist', '.next'].includes(entry)) continue;
    const fullPath = join(dir, entry);
    const s = await stat(fullPath).catch(() => null);
    if (!s) continue;
    if (s.isDirectory()) results.push(...await collectFiles(fullPath, exts, maxDepth, depth + 1));
    else if (exts.some(e => entry.endsWith(e))) results.push(fullPath);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Agent: Design Token Consistency Checker
// ---------------------------------------------------------------------------

const designTokenChecker: Agent = {
  id: 'design-token-consistency',
  name: 'Design Token Consistency',
  description: 'Validate CSS variables and Tailwind theme tokens are defined in a single source of truth',
  clusterId: 'design-system',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Design Tokens: ${ctx.repoAlias}`);

    const issues: string[] = [];

    // Check Tailwind config exists and has theme extensions
    let hasTailwindConfig = false;
    for (const name of ['tailwind.config.ts', 'tailwind.config.js', 'tailwind.config.mjs']) {
      try {
        const content = await readFile(join(ctx.localPath, name), 'utf-8');
        hasTailwindConfig = true;
        if (!content.includes('extend') && !content.includes('theme')) {
          issues.push(`${name}: No theme.extend section — tokens may be using defaults only`);
        }
        // Check for color definitions
        if (content.includes('colors')) {
          ctx.logger.info(`Custom colors defined in ${name}`);
        }
      } catch { /* file doesn't exist */ }
    }

    if (!hasTailwindConfig) {
      issues.push('No tailwind.config found — design tokens not centralized');
    }

    // Check for CSS variables in global CSS
    const globalCssFiles = ['src/index.css', 'src/globals.css', 'app/globals.css', 'src/app/globals.css'];
    let cssVarCount = 0;
    for (const cssFile of globalCssFiles) {
      try {
        const content = await readFile(join(ctx.localPath, cssFile), 'utf-8');
        const vars = content.match(/--[\w-]+:/g);
        if (vars) cssVarCount += vars.length;
      } catch { /* skip */ }
    }

    ctx.logger.info(`CSS variables: ${cssVarCount} | Tailwind config: ${hasTailwindConfig}`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: issues.length === 0 ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${cssVarCount} CSS vars, tailwind: ${hasTailwindConfig}, ${issues.length} issues`,
      artifacts: issues,
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Component Contract Validator
// ---------------------------------------------------------------------------

const componentContractValidator: Agent = {
  id: 'component-contract-validator',
  name: 'Component Contract Validator',
  description: 'Ensure shared UI components export typed prop interfaces (not inline/any)',
  clusterId: 'design-system',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Component Contracts: ${ctx.repoAlias}`);

    // Find shared UI components
    const uiDirs = ['src/components/ui', 'src/shared/ui', 'components/ui'];
    const componentFiles: string[] = [];
    for (const d of uiDirs) {
      componentFiles.push(...await collectFiles(join(ctx.localPath, d), ['.tsx']));
    }

    const violations: string[] = [];
    let totalComponents = 0;
    let typedComponents = 0;

    for (const file of componentFiles.slice(0, 80)) {
      try {
        const content = await readFile(file, 'utf-8');
        // Check if this is a component file (exports a function component)
        if (!content.match(/export\s+(default\s+)?function|export\s+const\s+\w+.*=.*React\.FC|export\s+const\s+\w+.*=.*\(props/)) {
          continue;
        }
        totalComponents++;

        // Check for typed props (interface/type export)
        const hasTypedProps = /(?:export\s+)?(?:interface|type)\s+\w+Props\b/.test(content);
        const hasInlineProps = /\(\s*\{[^}]*\}\s*:\s*\{[^}]*\}\s*\)/.test(content);
        const hasAnyProps = /props\s*:\s*any/.test(content);

        if (hasTypedProps) {
          typedComponents++;
        } else if (hasInlineProps) {
          violations.push(`${file}: Props defined inline — extract to named interface`);
        } else if (hasAnyProps) {
          violations.push(`${file}: Uses 'any' for props — add proper type`);
        }
      } catch { /* skip */ }
    }

    ctx.logger.info(`${typedComponents}/${totalComponents} components have typed prop interfaces`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: violations.length === 0 ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${typedComponents}/${totalComponents} typed, ${violations.length} violations`,
      artifacts: violations,
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Design Spec Generator
// ---------------------------------------------------------------------------

const designSpecGenerator: Agent = {
  id: 'design-spec-generator',
  name: 'Design Spec Generator',
  description: 'Generate a design spec summary: breakpoints, color palette, typography, component inventory',
  clusterId: 'design-system',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Design Spec: ${ctx.repoAlias}`);

    const spec: string[] = [];

    // Extract breakpoints from Tailwind
    for (const name of ['tailwind.config.ts', 'tailwind.config.js', 'tailwind.config.mjs']) {
      try {
        const content = await readFile(join(ctx.localPath, name), 'utf-8');
        const screens = content.match(/screens\s*:\s*\{([^}]+)\}/s);
        if (screens?.[1]) spec.push(`Breakpoints: ${screens[1].trim()}`);
      } catch { /* skip */ }
    }

    // Count component categories in shared/ui or components/ui
    for (const uiDir of ['src/components/ui', 'src/shared/ui']) {
      try {
        const entries = await readdir(join(ctx.localPath, uiDir));
        const components = entries.filter(e => e.endsWith('.tsx'));
        spec.push(`UI components (${uiDir}): ${components.length}`);
      } catch { /* skip */ }
    }

    // Check fonts
    const fontFiles = ['src/index.css', 'src/globals.css', 'app/globals.css', 'src/app/globals.css', 'app/layout.tsx'];
    for (const f of fontFiles) {
      try {
        const content = await readFile(join(ctx.localPath, f), 'utf-8');
        const fonts = content.match(/font-family[:\s]+['"]?([^'";,}]+)/g);
        if (fonts) spec.push(`Fonts (${f}): ${fonts.map(m => m.replace(/font-family[:\s]+['"]?/, '')).join(', ')}`);
      } catch { /* skip */ }
    }

    ctx.logger.info(`Spec items: ${spec.length}`);
    for (const s of spec) ctx.logger.info(`  ${s}`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${spec.length} design spec items extracted`,
      artifacts: spec,
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Responsive Constraint Auditor
// ---------------------------------------------------------------------------

const responsiveConstraintAuditor: Agent = {
  id: 'responsive-constraint-auditor',
  name: 'Responsive Constraint Auditor',
  description: 'Detect pages/components missing responsive breakpoints or with fixed widths',
  clusterId: 'design-system',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Responsive Audit: ${ctx.repoAlias}`);

    const pageFiles = await collectFiles(join(ctx.localPath, 'src', 'pages'), ['.tsx']);
    const appFiles = await collectFiles(join(ctx.localPath, 'src', 'app'), ['.tsx']);
    const allPages = [...pageFiles, ...appFiles].slice(0, 50);

    const issues: string[] = [];

    for (const file of allPages) {
      try {
        const content = await readFile(file, 'utf-8');
        // Check for fixed widths (px without responsive)
        const fixedWidths = content.match(/(?:width|w-)\[?\d+px/g);
        if (fixedWidths && fixedWidths.length > 2) {
          issues.push(`${file}: ${fixedWidths.length} fixed-width values — consider responsive classes`);
        }
        // Check if using any responsive prefixes
        const hasResponsive = /\b(?:sm:|md:|lg:|xl:|2xl:)/.test(content);
        if (!hasResponsive && content.length > 500) {
          issues.push(`${file}: No responsive breakpoint prefixes detected`);
        }
      } catch { /* skip */ }
    }

    ctx.logger.info(`${issues.length} responsive issues across ${allPages.length} pages`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: issues.length === 0 ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${issues.length} responsive issues in ${allPages.length} pages`,
      artifacts: issues,
    };
  },
};

export const designSystemV2Agents: Agent[] = [
  designTokenChecker,
  componentContractValidator,
  designSpecGenerator,
  responsiveConstraintAuditor,
];
