/**
 * Prompt parsers — extract structured data from .prompt.md files.
 *
 * Supports two prompt formats:
 *   Format A: .github/prompts/ — YAML frontmatter with description & agent fields
 *   Format B: docs/agent-prompts/ — Markdown headers with P0-P8 priority system
 */
import { basename } from 'node:path';
import type { ParsedPrompt } from './types.js';

// ---------------------------------------------------------------------------
// Content normalization
// ---------------------------------------------------------------------------

/**
 * Strip ```prompt wrapper blocks and YAML frontmatter (--- ... ---).
 * Some repos wrap prompt content in fenced code blocks.
 * Returns { content, frontmatter } where frontmatter is the parsed YAML fields.
 */
export function normalizeContent(raw: string): { content: string; frontmatter: Record<string, string> } {
  let content = raw;
  const frontmatter: Record<string, string> = {};

  // Strip ```prompt ... ``` wrapper (greedy to skip internal code fences)
  const promptBlockMatch = content.match(/^````?prompt\s*\n([\s\S]*)````?\s*$/m);
  if (promptBlockMatch) {
    content = promptBlockMatch[1]!;
  }

  // Strip YAML frontmatter (--- ... ---) and extract key: value pairs
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (frontmatterMatch) {
    const yamlBlock = frontmatterMatch[1]!;
    for (const line of yamlBlock.split('\n')) {
      const kv = line.match(/^(\w+)\s*:\s*(.+)$/);
      if (kv) {
        frontmatter[kv[1]!.trim()] = kv[2]!.replace(/^["']|["']$/g, '').trim();
      }
    }
    content = content.slice(frontmatterMatch[0].length);
  }

  return { content, frontmatter };
}

// ---------------------------------------------------------------------------
// Dependency parser
// ---------------------------------------------------------------------------

/**
 * Parse dependency declarations from prompt markdown body.
 * Supports:
 *   - "**Dependencies**: Gaps #20 must be completed first." → ['#20']
 *   - "**Dependencies**: Gaps #7, #8" → ['#7', '#8']
 *   - "**Dependencies**: None" or "can run in parallel" → []
 *   - "**Depends On**: FI-01, FI-03" → ['FI-01', 'FI-03']
 *   - "**Dependencies**: 01-supabase-client-setup" → ['01-supabase-client-setup']
 */
export function parseDependencies(content: string): string[] {
  const depLineMatch = content.match(/\*\*Dependenc(?:ies|y)\*\*:\s*(.+)/i)
    ?? content.match(/\*\*Depends? On\*\*:\s*(.+)/i);

  if (!depLineMatch) return [];
  const depLine = depLineMatch[1]!.trim();

  if (/^none\b/i.test(depLine) || /can run in parallel/i.test(depLine)) return [];

  const deps: string[] = [];

  for (const m of depLine.matchAll(/#(\d+)/g)) {
    deps.push(`#${m[1]}`);
  }
  if (deps.length > 0) return deps;

  for (const m of depLine.matchAll(/([A-Z]+-\d+)/g)) {
    deps.push(m[1]!);
  }
  if (deps.length > 0) return deps;

  for (const m of depLine.matchAll(/(\d{2}-[a-z][a-z0-9-]+)/g)) {
    deps.push(m[1]!);
  }

  return deps;
}

// ---------------------------------------------------------------------------
// Metadata field extraction (dual-format)
// ---------------------------------------------------------------------------

/**
 * Extract a metadata field from either inline or table format.
 *
 * Inline:  **Priority**: P0
 * Table:   | **Priority** | P0 |
 * Table (no bold): | Priority | P0 |
 */
export function extractField(content: string, fieldName: string, valuePattern: string = '.+'): string | null {
  // Try inline format: **FieldName**: value
  const inline = content.match(new RegExp(`\\*\\*${fieldName}\\*\\*:\\s*(${valuePattern})`, 'i'));
  if (inline) return inline[1]!.trim();

  // Try table format: | **FieldName** | value |
  const table = content.match(new RegExp(`\\|\\s*\\*\\*${fieldName}\\*\\*\\s*\\|\\s*(${valuePattern})\\s*\\|`, 'i'));
  if (table) return table[1]!.trim();

  // Try table format without bold: | FieldName | value |
  const tablePlain = content.match(new RegExp(`\\|\\s*${fieldName}\\s*\\|\\s*(${valuePattern})\\s*\\|`, 'i'));
  if (tablePlain) return tablePlain[1]!.trim();

  return null;
}

// ---------------------------------------------------------------------------
// Format B parser (structured markdown with metadata header)
// ---------------------------------------------------------------------------

export function parseFormatB(content: string, filePath: string): ParsedPrompt {
  const lines = content.split('\n');
  const titleMatch = content.match(/^#\s+(?:PROMPT:\s*)?(.+)/m);

  const priorityRaw = extractField(content, 'Priority', 'P\\d');
  const statusRaw = extractField(content, 'Status');
  const timeRaw = extractField(content, 'Estimated (?:Time|Hours)');
  const agentRaw = extractField(content, 'Agent Type');
  const revenueRaw = extractField(content, 'Revenue Impact');
  const objectiveMatch = content.match(/## Objective\s+(.+?)(?=\n---|\n##)/s)
    ?? content.match(/## Implementation Plan\s+(.+?)(?=\n---|\n##)/s);

  const sections = [...content.matchAll(/^## (.+)/gm)].map(m => m[1]!);
  const checklistItems = (content.match(/- \[[ x~]\]/g) ?? []).length;

  return {
    filePath,
    fileName: basename(filePath),
    format: 'B',
    title: titleMatch?.[1]?.replace(/\s*\(P\d\)\s*$/, '').trim() ?? basename(filePath, '.prompt.md'),
    priority: priorityRaw ?? null,
    scope: null,
    type: null,
    status: statusRaw?.replace(/\*+/g, '').trim() ?? null,
    estimatedTime: timeRaw ?? null,
    agentType: agentRaw ?? null,
    revenueImpact: revenueRaw ?? null,
    objective: objectiveMatch?.[1]?.trim() ?? null,
    hasSuccessCriteria: /## Success Criteria/i.test(content) || /## Quality Gate/i.test(content),
    hasTestingChecklist: /## Testing Checklist/i.test(content) || /## Quality Gate/i.test(content),
    hasDatabaseSchema: /## Database Schema/i.test(content) || /CREATE TABLE|ALTER TABLE/i.test(content),
    hasReferenceImpl: /Reference Implementation/i.test(content),
    hasCodeExamples: /```(?:typescript|tsx?|javascript|jsx?|sql|bash)/i.test(content),
    hasFilesToModify: /## Files to (?:Modify|Create|Touch)/i.test(content) || /## File Changes/i.test(content),
    hasTags: /## Tags\b/i.test(content) || /\*\*Tags\*\*:\s*\S/i.test(content) || /\*\*Labels\*\*:\s*\S/i.test(content),
    hasEnvironment: /## Environment\b/i.test(content) || /\*\*Environment\*\*:\s*\S/i.test(content) || /\*\*Requires\*\*:.*(?:_KEY|_URL|_SECRET)/i.test(content),
    hasBlockingGate: /## Blocking\b/i.test(content) || /\*\*Do Not Start Until\*\*:\s*\S/i.test(content) || /\*\*Prerequisites\*\*:\s*\S/i.test(content),
    hasMergeGate: /## Merge Requirements/i.test(content) || /\*\*Do Not Merge Until\*\*:\s*\S/i.test(content) || /\*\*Merge Gate\*\*:\s*\S/i.test(content),
    sections,
    checklistItems,
    totalLines: lines.length,
    depends: parseDependencies(content),
    raw: content,
  };
}

// ---------------------------------------------------------------------------
// Format A parser (YAML frontmatter)
// ---------------------------------------------------------------------------

export function parseFormatA(content: string, filePath: string): ParsedPrompt {
  const lines = content.split('\n');

  const titleMatch = content.match(/^#\s+(.+)/m);
  const descMatch = content.match(/description:\s*['"]?(.+?)['"]?\s*$/m);
  const agentMatch = content.match(/agent:\s*['"]?(.+?)['"]?\s*$/m);

  const sections = [...content.matchAll(/^## (.+)/gm)].map(m => m[1]!);
  const checklistItems = (content.match(/- \[[ x~]\]/g) ?? []).length;

  return {
    filePath,
    fileName: basename(filePath),
    format: 'A',
    title: titleMatch?.[1]?.trim() ?? basename(filePath, '.prompt.md'),
    priority: null, // Format A doesn't have priority
    scope: null,
    type: null,
    status: null,
    estimatedTime: null,
    agentType: agentMatch?.[1]?.trim() ?? descMatch?.[1]?.trim() ?? null,
    revenueImpact: null,
    objective: descMatch?.[1]?.trim() ?? null,
    hasSuccessCriteria: /## Success Criteria/i.test(content) || /## Verification/i.test(content),
    hasTestingChecklist: /## Testing/i.test(content) || /## Validation/i.test(content),
    hasDatabaseSchema: /CREATE TABLE|ALTER TABLE/i.test(content),
    hasReferenceImpl: /Reference|Example/i.test(content),
    hasCodeExamples: /```(?:typescript|tsx?|javascript|jsx?|sql|bash)/i.test(content),
    hasFilesToModify: /## Files to (?:Modify|Create|Touch)/i.test(content) || /## File Changes/i.test(content),
    hasTags: /## Tags\b/i.test(content) || /\*\*Tags\*\*:\s*\S/i.test(content) || /\*\*Labels\*\*:\s*\S/i.test(content),
    hasEnvironment: /## Environment\b/i.test(content) || /\*\*Environment\*\*:\s*\S/i.test(content) || /\*\*Requires\*\*:.*(?:_KEY|_URL|_SECRET)/i.test(content),
    hasBlockingGate: /## Blocking\b/i.test(content) || /\*\*Do Not Start Until\*\*:\s*\S/i.test(content) || /\*\*Prerequisites\*\*:\s*\S/i.test(content),
    hasMergeGate: /## Merge Requirements/i.test(content) || /\*\*Do Not Merge Until\*\*:\s*\S/i.test(content) || /\*\*Merge Gate\*\*:\s*\S/i.test(content),
    sections,
    checklistItems,
    totalLines: lines.length,
    depends: parseDependencies(content),
    raw: content,
  };
}
