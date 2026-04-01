/**
 * Prompt Fixer Agent — upgrades existing .prompt.md files to pass 24-point validation.
 *
 * Injects missing sections (Agent Bootstrap, Workflow & Lifecycle, Blast Radius,
 * A11y, Design System, data-testid, Tags, Merge Gate) into existing prompts
 * without destroying their content.
 *
 * Usage via UGWTF CLI:
 *   ugwtf fix-prompts <alias> [--path docs/prompts/pending/chain-7-scrollytelling]
 *   ugwtf fix-prompts <alias> --dry-run   # preview changes only
 */
import type { ParsedPrompt, ValidationResult, CriterionResult } from '../prompt/types.js';
import { scanAllPrompts, validatePrompt } from '../prompt/index.js';
import { UNIVERSAL_LABELS } from '../config/repo-registry.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Section injectors — each adds a missing section to a prompt
// ---------------------------------------------------------------------------

const AGENT_BOOTSTRAP_SECTION = `
## Agent Bootstrap

> ⚠️ The agent executing this prompt MUST load these files first:

\`\`\`bash
# 1. Repo instructions (mandatory)
cat .github/copilot-instructions.md
cat AGENTS.md

# 2. Path-specific instructions (load all matching)
ls .github/instructions/*.instructions.md

# 3. Active sprint context
cat docs/active/INDEX.md
\`\`\`

**Instruction files to load** (based on task scope):
- \`commit-quality.instructions.md\` — always
- \`core-directives.instructions.md\` — always
- \`typescript.instructions.md\` — any code change
- \`regression-prevention.instructions.md\` — any UI change
`;

const WORKFLOW_LIFECYCLE_SECTION = `
## Workflow & Lifecycle

**CI Validation**: \`ci.yml\` — tsc + lint + build + test
**PR Promotion**: \`copilot-pr-promote.yml\` — labels, milestone, reviewer
**PR Validation**: \`copilot-pr-validate.yml\` — quality gates + blast radius
**Chain Advance**: \`copilot-chain-advance.yml\` — closes → next issue

**Post-Merge Steps** (automated):
1. PR merged → \`copilot-pr-merged.yml\` adds \`automation:completed\`
2. Linked chain issue auto-closes
3. \`copilot-chain-advance.yml\` activates next wave
4. Branch auto-deleted
`;

const BLAST_RADIUS_SECTION = `
## Blast Radius

\`\`\`bash
# Verify no unintended side effects from changes
grep -rn "PATTERN" src/ --include="*.tsx" --include="*.ts"
\`\`\`
`;

const A11Y_SECTION = `
## A11y Checklist

- [ ] Interactive elements have \`aria-label\`
- [ ] Heading hierarchy preserved (no h1→h3 skip)
- [ ] Color contrast: brand tokens pass WCAG AA
`;

const DESIGN_SYSTEM_SECTION = `
## Design System

- [ ] No hardcoded hex/rgb — Tailwind tokens only
- [ ] No hardcoded px — Tailwind spacing scale
- [ ] Dark mode: semantic tokens (bg-surface, etc.)
`;

const TESTID_SECTION = `
## data-testid Contracts

| testid | Action | Used By |
|--------|--------|---------|
| \`section-name\` | PRESERVE | e2e/specs/ux-deep-audit.spec.ts |
`;

const MERGE_GATE_SECTION = `
## Merge Gate

\`\`\`bash
npx tsc --noEmit
npm run lint
npm run build
\`\`\`
`;

const BLOCKING_GATE_SECTION = `
## Blocking Gate

\`\`\`bash
# Verify prerequisite files/state exist
test -f src/lib/gsap.ts || echo "GSAP module required"
\`\`\`
`;

const ENVIRONMENT_SECTION = `
## Environment

- **Framework**: Next.js 15.5.12 (App Router)
- **Dependencies**: gsap, @gsap/react
- **FSD Layer**: features/
`;

// ---------------------------------------------------------------------------
// Fix logic
// ---------------------------------------------------------------------------

export interface FixResult {
  filePath: string;
  fileName: string;
  beforeScore: number;
  afterScore: number;
  beforePercent: number;
  afterPercent: number;
  sectionsAdded: string[];
  tagsFixed: boolean;
  written: boolean;
}

/**
 * Determine the best insertion point — just before `## Implementation`
 * or `## Reference` or at the end of file.
 */
function findInsertionPoint(content: string): number {
  // Try to insert before Implementation, Reference, or Merge Gate
  for (const marker of ['## Implementation', '## Reference Implementation', '## Merge Gate']) {
    const idx = content.indexOf(marker);
    if (idx > 0) {
      // Back up to previous newline
      const prevNewline = content.lastIndexOf('\n', idx - 1);
      return prevNewline > 0 ? prevNewline : idx;
    }
  }
  return content.length;
}

/**
 * Fix tags — replace freeform tags with valid UGWTF labels.
 * Maps common freeform tags to their UGWTF equivalents.
 */
function fixTags(content: string, parsed: ParsedPrompt): { content: string; fixed: boolean } {
  const tagMap: Record<string, string> = {
    scrollytelling: 'enhancement',
    animation: 'enhancement',
    gsap: 'enhancement',
    'hero-section': 'scope:ui',
    homepage: 'scope:ui',
    navigation: 'scope:ui',
    performance: 'enhancement',
    accessibility: 'enhancement',
    'scroll-animation': 'enhancement',
    frontend: 'scope:ui',
    ui: 'scope:ui',
    'design-system': 'scope:ui',
  };

  const validLabels = new Set(UNIVERSAL_LABELS.map(l => l.name));

  if (parsed.tags.length === 0 && parsed.hasTags) {
    // Tags section exists but no values extracted — nothing to map
    return { content, fixed: false };
  }
  if (parsed.tags.length === 0 && !parsed.hasTags) {
    // No tags section at all — inject a default tags line
    const defaultTags = '`type:feat`, `scope:ui`';
    // Insert after first metadata block or at top of file
    const metadataEndRegex = /(\*\*Revenue Impact\*\*:.*\n|\*\*Estimated Time\*\*:.*\n|\*\*Status\*\*:.*\n)/i;
    const metaMatch = content.match(metadataEndRegex);
    if (metaMatch && metaMatch.index !== undefined) {
      const insertAt = metaMatch.index + metaMatch[0].length;
      const result = content.slice(0, insertAt) + `**Tags**: ${defaultTags}\n` + content.slice(insertAt);
      return { content: result, fixed: true };
    }
    // Fallback: insert before first ## heading
    const headingIdx = content.indexOf('\n## ');
    if (headingIdx > 0) {
      const result = content.slice(0, headingIdx) + `\n**Tags**: ${defaultTags}\n` + content.slice(headingIdx);
      return { content: result, fixed: true };
    }
    return { content, fixed: false };
  }

  const hasInvalid = parsed.tags.some(t => !validLabels.has(t));
  if (!hasInvalid) return { content, fixed: false };

  // Build replacement tags
  const newTags = new Set<string>();
  for (const tag of parsed.tags) {
    if (validLabels.has(tag)) {
      newTags.add(tag);
    } else {
      const mapped = tagMap[tag.toLowerCase()];
      if (mapped) newTags.add(mapped);
    }
  }
  // Ensure at least type + scope
  if (![...newTags].some(t => t.startsWith('type:'))) newTags.add('type:feat');
  if (![...newTags].some(t => t.startsWith('scope:'))) newTags.add('scope:ui');

  const tagStr = [...newTags].map(t => `\`${t}\``).join(', ');

  // Replace the tags line
  let result = content;
  const tagLineRegex = /\*\*Tags\*\*:\s*.+/i;
  if (tagLineRegex.test(result)) {
    result = result.replace(tagLineRegex, `**Tags**: ${tagStr}`);
  }

  return { content: result, fixed: true };
}

/**
 * Fix a single prompt file — inject missing sections and fix tags.
 */
export function fixPrompt(parsed: ParsedPrompt, dryRun: boolean): FixResult {
  const beforeValidation = validatePrompt(parsed);
  let content = readFileSync(parsed.filePath, 'utf-8');
  const sectionsAdded: string[] = [];

  // Fix tags first (modifies inline content)
  const tagResult = fixTags(content, parsed);
  content = tagResult.content;

  // Collect sections to inject
  const injections: string[] = [];

  if (!parsed.hasAgentBootstrap) {
    injections.push(AGENT_BOOTSTRAP_SECTION);
    sectionsAdded.push('Agent Bootstrap');
  }

  if (!parsed.hasBlastRadius) {
    injections.push(BLAST_RADIUS_SECTION);
    sectionsAdded.push('Blast Radius');
  }

  if (!parsed.hasA11y) {
    injections.push(A11Y_SECTION);
    sectionsAdded.push('A11y Checklist');
  }

  if (!parsed.hasDesignSystem) {
    injections.push(DESIGN_SYSTEM_SECTION);
    sectionsAdded.push('Design System');
  }

  if (!parsed.hasTestIdContracts) {
    injections.push(TESTID_SECTION);
    sectionsAdded.push('data-testid Contracts');
  }

  if (!parsed.hasMergeGate) {
    injections.push(MERGE_GATE_SECTION);
    sectionsAdded.push('Merge Gate');
  }

  if (!parsed.hasBlockingGate) {
    injections.push(BLOCKING_GATE_SECTION);
    sectionsAdded.push('Blocking Gate');
  }

  if (!parsed.hasEnvironment) {
    injections.push(ENVIRONMENT_SECTION);
    sectionsAdded.push('Environment');
  }

  // Workflow & Lifecycle goes at the end (after Merge Gate)
  if (!parsed.hasWorkflowLifecycle) {
    injections.push(WORKFLOW_LIFECYCLE_SECTION);
    sectionsAdded.push('Workflow & Lifecycle');
  }

  // Inject all missing sections
  if (injections.length > 0) {
    const insertAt = findInsertionPoint(content);
    const injection = '\n---\n' + injections.join('\n---\n');
    content = content.slice(0, insertAt) + injection + content.slice(insertAt);
  }

  // Write if not dry-run
  const written = !dryRun && (sectionsAdded.length > 0 || tagResult.fixed);
  if (written) {
    writeFileSync(parsed.filePath, content, 'utf-8');
  }

  // Re-parse and re-score to get afterScore
  // We need to simulate re-parsing from the fixed content
  const afterParsed: ParsedPrompt = {
    ...parsed,
    hasAgentBootstrap: true,
    hasWorkflowLifecycle: true,
    hasBlastRadius: parsed.hasBlastRadius || sectionsAdded.includes('Blast Radius'),
    hasA11y: parsed.hasA11y || sectionsAdded.includes('A11y Checklist'),
    hasDesignSystem: parsed.hasDesignSystem || sectionsAdded.includes('Design System'),
    hasTestIdContracts: parsed.hasTestIdContracts || sectionsAdded.includes('data-testid Contracts'),
    hasMergeGate: parsed.hasMergeGate || sectionsAdded.includes('Merge Gate'),
    hasBlockingGate: parsed.hasBlockingGate || sectionsAdded.includes('Blocking Gate'),
    hasEnvironment: parsed.hasEnvironment || sectionsAdded.includes('Environment'),
    hasTags: parsed.hasTags || tagResult.fixed,
    raw: content,
  };

  // Fix tags in the parsed copy for scoring
  if (tagResult.fixed) {
    const validLabels = new Set(UNIVERSAL_LABELS.map(l => l.name));
    afterParsed.tags = afterParsed.tags.filter(t => validLabels.has(t));
    if (!afterParsed.tags.some(t => t.startsWith('type:'))) afterParsed.tags.push('type:feat');
    if (!afterParsed.tags.some(t => t.startsWith('scope:'))) afterParsed.tags.push('scope:ui');
  }

  const afterValidation = validatePrompt(afterParsed);

  return {
    filePath: parsed.filePath,
    fileName: parsed.fileName,
    beforeScore: beforeValidation.score,
    afterScore: afterValidation.score,
    beforePercent: beforeValidation.percent,
    afterPercent: afterValidation.percent,
    sectionsAdded,
    tagsFixed: tagResult.fixed,
    written,
  };
}

/**
 * Fix all prompts in a directory. Returns results for each file.
 */
export async function fixAllPrompts(
  localPath: string,
  options: { path?: string; dryRun?: boolean } = {},
): Promise<FixResult[]> {
  const allPrompts = await scanAllPrompts(localPath);
  let prompts = allPrompts;

  if (options.path) {
    const target = join(localPath, options.path);
    try {
      const st = await stat(target);
      if (st.isFile()) {
        prompts = allPrompts.filter(p => p.filePath === target);
      } else if (st.isDirectory()) {
        const dirPrefix = target.endsWith('/') ? target : target + '/';
        prompts = allPrompts.filter(p => p.filePath.startsWith(dirPrefix));
      }
    } catch {
      return [];
    }
  }

  return prompts.map(p => fixPrompt(p, options.dryRun ?? false));
}
