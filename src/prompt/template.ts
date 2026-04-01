/**
 * Prompt template renderer — loads the template and replaces {{PLACEHOLDER}} tokens.
 *
 * Usage:
 *   import { renderTemplate, TEMPLATE_VARS } from './template.js';
 *   const md = renderTemplate({ TITLE: 'Add size guide', PRIORITY: 'P1', ... });
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Template path resolution
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(__dirname, '..', '..', 'templates', 'prompt-template.prompt.md');

// ---------------------------------------------------------------------------
// All supported placeholder keys
// ---------------------------------------------------------------------------

export const TEMPLATE_VARS = [
  'TITLE', 'PRIORITY', 'ESTIMATED_TIME', 'REVENUE_IMPACT',
  'DEPENDENCIES', 'TAGS', 'SCOPE_INSTRUCTIONS',
  'OBJECTIVE', 'PRE_FLIGHT_COMMANDS', 'INTENDED_RESULT',
  'FILES_TABLE_ROWS', 'TESTID_TABLE_ROWS',
  'BLAST_RADIUS_COMMANDS', 'EXTRA_A11Y_ITEMS', 'EXTRA_DESIGN_ITEMS',
  'SUCCESS_CRITERIA', 'EXTRA_TEST_COMMANDS',
  'IMPLEMENTATION', 'REFERENCE_IMPL',
  'FRAMEWORK', 'PACKAGES', 'FSD_LAYER',
  'DATABASE_SECTION', 'ROUTES_AFFECTED',
  'BLOCKING_GATE_COMMANDS', 'E2E_SPEC_FILES',
] as const;

export type TemplateVarKey = (typeof TEMPLATE_VARS)[number];
export type TemplateVars = Partial<Record<TemplateVarKey, string>>;

// ---------------------------------------------------------------------------
// Defaults for optional sections
// ---------------------------------------------------------------------------

const DEFAULTS: Partial<Record<TemplateVarKey, string>> = {
  PRIORITY: 'P2',
  ESTIMATED_TIME: '30 minutes',
  REVENUE_IMPACT: 'Medium',
  DEPENDENCIES: 'None',
  TAGS: '`type:feat`, `scope:ui`',
  SCOPE_INSTRUCTIONS: '`tailwind.instructions.md`',
  PRE_FLIGHT_COMMANDS: '# No pre-flight checks required',
  BLAST_RADIUS_COMMANDS: '# Verify no unintended side effects\ngrep -rn "PATTERN" src/ --include="*.tsx"',
  EXTRA_A11Y_ITEMS: '',
  EXTRA_DESIGN_ITEMS: '',
  EXTRA_TEST_COMMANDS: '# No extra tests',
  FRAMEWORK: 'Next.js 15.5.12 (App Router)',
  PACKAGES: 'None additional',
  FSD_LAYER: 'features/',
  DATABASE_SECTION: 'No database changes required.',
  ROUTES_AFFECTED: 'None',
  BLOCKING_GATE_COMMANDS: '# No blocking prerequisites',
  E2E_SPEC_FILES: '# No feature-specific E2E specs yet',
};

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

/**
 * Load the template and replace all `{{KEY}}` placeholders with provided values.
 * Missing keys fall back to DEFAULTS, then to the literal `{{KEY}}` (left in place).
 */
export function renderTemplate(vars: TemplateVars): string {
  let template: string;
  try {
    template = readFileSync(TEMPLATE_PATH, 'utf-8');
  } catch {
    throw new Error(`Template not found at ${TEMPLATE_PATH}. Run from the ugwtf repo root.`);
  }

  let result = template;
  for (const key of TEMPLATE_VARS) {
    const value = vars[key] ?? DEFAULTS[key];
    if (value !== undefined) {
      result = result.replaceAll(`{{${key}}}`, value);
    }
    // else: leave {{KEY}} in place — signals unfilled required field
  }

  return result;
}

/**
 * List all unfilled (required) placeholders still present in rendered output.
 * Useful for validation — these must be filled before the prompt passes scoring.
 */
export function findUnfilledPlaceholders(rendered: string): string[] {
  const matches = rendered.match(/\{\{[A-Z_]+\}\}/g) ?? [];
  return [...new Set(matches)].map(m => m.replace(/\{\{|\}\}/g, ''));
}
