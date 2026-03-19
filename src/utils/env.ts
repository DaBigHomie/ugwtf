/**
 * Minimal `.env` file loader — zero dependencies.
 *
 * Reads a `.env` file and populates `process.env` for any keys not already set.
 * Existing env vars always take precedence (no overwrite).
 *
 * Supported syntax:
 *   KEY=value
 *   KEY="quoted value"
 *   KEY='single quoted value'
 *   # comments
 *   empty lines (ignored)
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Load `.env` file from the given directory (defaults to cwd).
 * Does NOT overwrite existing env vars.
 *
 * @param dir - Directory containing the `.env` file.
 * @returns Number of new variables set.
 */
export function loadEnv(dir?: string): number {
  const envPath = join(dir ?? process.cwd(), '.env');
  if (!existsSync(envPath)) return 0;

  let content: string;
  try {
    content = readFileSync(envPath, 'utf-8');
  } catch {
    return 0;
  }

  let count = 0;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Only set if not already in env (existing vars take precedence)
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
      count++;
    }
  }

  return count;
}
