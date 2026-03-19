/**
 * Format A Prompt Scanner — discovers .github/prompts/*.prompt.md files
 * and extracts YAML frontmatter metadata.
 *
 * Designed to be compatible with UGWTF prompt-agents.ts scanner.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

export interface PromptMeta {
  /** File name without extension, e.g. "P01-dark-mode-hero" */
  id: string;
  /** Full file path */
  path: string;
  /** Extracted YAML fields */
  title?: string;
  description?: string;
  priority?: string;
  estimatedTime?: string;
  cluster?: string;
  wave?: number;
  severity?: string;
  /** Raw YAML frontmatter text */
  rawFrontmatter: string;
  /** Body text after frontmatter */
  body: string;
}

/**
 * Scan a repo's .github/prompts/ directory for Format A prompts.
 * Returns parsed prompt metadata sorted by filename.
 */
export function scanPrompts(root: string): PromptMeta[] {
  const promptDir = join(root, '.github', 'prompts');
  if (!existsSync(promptDir)) return [];

  const files = readdirSync(promptDir)
    .filter(f => f.endsWith('.prompt.md'))
    .sort();

  return files.map(file => {
    const fullPath = join(promptDir, file);
    const content = readFileSync(fullPath, 'utf-8');
    const id = basename(file, '.prompt.md');

    // Parse YAML frontmatter (between --- markers)
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const rawFrontmatter = fmMatch ? fmMatch[1]! : '';
    const body = fmMatch ? content.slice(fmMatch[0].length).trim() : content;

    // Extract known fields from YAML
    const fields: Record<string, string> = {};
    for (const line of rawFrontmatter.split('\n')) {
      const kv = line.match(/^(\w[\w-]*):\s*(.+)$/);
      if (kv) fields[kv[1]!] = kv[2]!.replace(/^["']|["']$/g, '');
    }

    return {
      id,
      path: fullPath,
      title: fields['title'],
      description: fields['description'],
      priority: fields['priority'],
      estimatedTime: fields['estimatedTime'],
      cluster: fields['cluster'],
      wave: fields['wave'] ? parseInt(fields['wave'], 10) : undefined,
      severity: fields['severity'],
      rawFrontmatter,
      body,
    };
  });
}

/**
 * Validate prompt quality. Returns score 0-100 and list of issues.
 * Compatible with UGWTF prompt-validator scoring.
 */
export function validatePrompt(prompt: PromptMeta): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  if (!prompt.title) { issues.push('Missing title'); score -= 15; }
  if (!prompt.description) { issues.push('Missing description'); score -= 10; }
  if (!prompt.priority) { issues.push('Missing priority field'); score -= 10; }
  if (!prompt.estimatedTime) { issues.push('Missing estimatedTime'); score -= 5; }
  if (!prompt.cluster) { issues.push('Missing cluster field'); score -= 10; }
  if (!prompt.wave) { issues.push('Missing wave field'); score -= 5; }
  if (!prompt.severity) { issues.push('Missing severity field'); score -= 5; }
  if (prompt.body.length < 100) { issues.push('Body too short (<100 chars)'); score -= 10; }
  if (!prompt.rawFrontmatter) { issues.push('No YAML frontmatter'); score -= 30; }

  return { score: Math.max(0, score), issues };
}
