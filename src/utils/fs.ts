/**
 * Shared utilities used by all generators.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { RepoConfig } from '../config/repo-registry.js';

export interface WriteResult {
  path: string;
  action: 'created' | 'updated' | 'skipped';
}

/**
 * Write content to a file, creating directories as needed.
 * If the file already exists with identical content, skip the write.
 */
export function writeFile(absolutePath: string, content: string): WriteResult {
  mkdirSync(dirname(absolutePath), { recursive: true });

  if (existsSync(absolutePath)) {
    const existing = readFileSync(absolutePath, 'utf-8');
    if (existing === content) {
      return { path: absolutePath, action: 'skipped' };
    }
    writeFileSync(absolutePath, content, 'utf-8');
    return { path: absolutePath, action: 'updated' };
  }

  writeFileSync(absolutePath, content, 'utf-8');
  return { path: absolutePath, action: 'created' };
}

/** Resolve an absolute path inside a repo */
export function repoPath(repo: RepoConfig, ...segments: string[]): string {
  return join(repo.localPath, ...segments);
}

/** Produce YAML-safe string (double-quoted, escaped) */
export function yamlStr(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}
