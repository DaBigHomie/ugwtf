/**
 * Prompt scanner — discovers and parses .prompt.md files from known locations.
 *
 * Scans three roots per repo:
 *   .github/prompts/      → Format A (YAML frontmatter)
 *   docs/agent-prompts/   → Format B (Markdown metadata)
 *   docs/prompts/         → auto-detected per file
 *
 * Results are cached per localPath to avoid redundant directory reads
 * within a single orchestrator run.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { ParsedPrompt } from './types.js';
import { normalizeContent, parseFormatA, parseFormatB } from './parse.js';

// ---------------------------------------------------------------------------
// Directory scanners (recursive)
// ---------------------------------------------------------------------------

/**
 * Scan a directory tree for .prompt.md files using a fixed format.
 */
async function scanDirectory(
  dirPath: string,
  format: 'A' | 'B',
): Promise<ParsedPrompt[]> {
  const prompts: ParsedPrompt[] = [];
  try {
    const entries = await readdir(dirPath);
    const promptFiles = entries.filter(f => f.endsWith('.prompt.md'));

    for (const file of promptFiles) {
      try {
        const fullPath = join(dirPath, file);
        const raw = await readFile(fullPath, 'utf-8');
        const parsed = format === 'B'
          ? parseFormatB(raw, fullPath)
          : parseFormatA(raw, fullPath);
        prompts.push(parsed);
      } catch {
        // Skip unreadable files
      }
    }

    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      try {
        const subPath = join(dirPath, entry);
        const info = await stat(subPath);
        if (info.isDirectory()) {
          const subPrompts = await scanDirectory(subPath, format);
          prompts.push(...subPrompts);
        }
      } catch {
        // Skip inaccessible subdirectories
      }
    }
  } catch {
    // Directory doesn't exist — that's fine
  }
  return prompts;
}

/**
 * Scan a directory tree, auto-detecting format per file.
 * Files whose content (after stripping ```prompt wrappers) starts with ---
 * are parsed as Format A; others as Format B.
 */
async function scanDirectoryAuto(dirPath: string): Promise<ParsedPrompt[]> {
  const prompts: ParsedPrompt[] = [];
  try {
    const entries = await readdir(dirPath);
    const promptFiles = entries.filter(f => f.endsWith('.prompt.md'));

    for (const file of promptFiles) {
      try {
        const fullPath = join(dirPath, file);
        const raw = await readFile(fullPath, 'utf-8');
        const content = normalizeContent(raw);
        const format = content.trimStart().startsWith('---') ? 'A' : 'B';
        const parsed = format === 'B'
          ? parseFormatB(content, fullPath)
          : parseFormatA(content, fullPath);
        prompts.push(parsed);
      } catch {
        // Skip unreadable files
      }
    }

    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      try {
        const subPath = join(dirPath, entry);
        const info = await stat(subPath);
        if (info.isDirectory()) {
          const subPrompts = await scanDirectoryAuto(subPath);
          prompts.push(...subPrompts);
        }
      } catch {
        // Skip inaccessible subdirectories
      }
    }
  } catch {
    // Directory doesn't exist — that's fine
  }
  return prompts;
}

// ---------------------------------------------------------------------------
// Shared scan cache
// ---------------------------------------------------------------------------

const scanCache = new Map<string, ParsedPrompt[]>();

/**
 * Scan all three prompt roots for a repo, deduplicate by filePath, cache results.
 */
export async function scanAllPrompts(localPath: string): Promise<ParsedPrompt[]> {
  const cached = scanCache.get(localPath);
  if (cached) return cached;

  const formatA = await scanDirectory(join(localPath, '.github', 'prompts'), 'A');
  const formatB = await scanDirectory(join(localPath, 'docs', 'agent-prompts'), 'B');
  const docsPrompts = await scanDirectoryAuto(join(localPath, 'docs', 'prompts'));

  const byPath = new Map<string, ParsedPrompt>();
  for (const p of [...formatA, ...formatB, ...docsPrompts]) {
    byPath.set(p.filePath, p);
  }
  const all = [...byPath.values()];

  scanCache.set(localPath, all);
  return all;
}

/** Clear the scan cache (call between orchestrator runs if needed). */
export function clearPromptScanCache(): void {
  scanCache.clear();
}
