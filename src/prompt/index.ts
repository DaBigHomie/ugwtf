/**
 * src/prompt — Prompt parsing, scoring, and scanning module.
 *
 * Re-exports everything consumers need from a single entry point.
 */

// Types
export type { ParsedPrompt, CriterionResult, ValidationResult } from './types.js';

// Parse
export {
  normalizeContent,
  extractField,
  extractTags,
  extractFilePaths,
  parseDependencies,
  parseFormatA,
  parseFormatB,
} from './parse.js';

// Score
export { validatePrompt, parseEstimatedTime } from './score.js';

// Template
export { renderTemplate, findUnfilledPlaceholders, TEMPLATE_VARS } from './template.js';
export type { TemplateVars, TemplateVarKey } from './template.js';

// Fixer
export { fixPrompt, fixAllPrompts } from './fixer.js';
export type { FixResult } from './fixer.js';

// Scan
export { scanAllPrompts, clearPromptScanCache } from './scan.js';
