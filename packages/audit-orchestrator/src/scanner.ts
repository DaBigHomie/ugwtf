/**
 * File scanning utilities — pure fs, zero dependencies.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_IGNORE = ['node_modules', '.next', '.git', 'dist', '.vercel', '.turbo'];

export function findFiles(
  dir: string,
  ext: RegExp,
  ignore: string[] = DEFAULT_IGNORE,
): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  const stat = statSync(dir);
  if (!stat.isDirectory()) {
    // If given a file path, return it if it matches the extension
    if (ext.test(dir)) results.push(dir);
    return results;
  }
  for (const entry of readdirSync(dir)) {
    if (ignore.includes(entry)) continue;
    const full = join(dir, entry);
    const entryStat = statSync(full);
    if (entryStat.isDirectory()) {
      results.push(...findFiles(full, ext, ignore));
    } else if (ext.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

export function fileContains(
  filePath: string,
  patterns: (string | RegExp)[],
): boolean {
  if (!existsSync(filePath)) return false;
  const content = readFileSync(filePath, 'utf-8');
  return patterns.some((p) =>
    typeof p === 'string' ? content.includes(p) : p.test(content),
  );
}

export function countMatches(
  dir: string,
  pattern: RegExp,
  fileExt: RegExp = /\.(tsx?|jsx?)$/,
): number {
  let count = 0;
  for (const file of findFiles(dir, fileExt)) {
    const content = readFileSync(file, 'utf-8');
    const matches = content.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

export function readFileSafe(filePath: string): string {
  if (!existsSync(filePath)) return '';
  return readFileSync(filePath, 'utf-8');
}
