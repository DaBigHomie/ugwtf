/**
 * RC Config Loader
 *
 * Reads `.ugwtfrc.json` from the working directory or a specified path
 * and returns validated defaults. CLI flags always take precedence.
 *
 * Schema:
 * ```json
 * {
 *   "defaultRepos": ["damieus", "ffs"],
 *   "dryRun": false,
 *   "verbose": false,
 *   "concurrency": 3,
 *   "output": "summary"
 * }
 * ```
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { OutputFormat } from '../types.js';

export interface UGWTFRCConfig {
  defaultRepos?: string[];
  dryRun?: boolean;
  verbose?: boolean;
  concurrency?: number;
  output?: OutputFormat;
  /** External repos to register at startup (G48) */
  repos?: Array<{
    slug: string;
    alias: string;
    framework?: string;
    localPath?: string;
    nodeVersion?: string;
    defaultBranch?: string;
    [key: string]: unknown;
  }>;
}

const VALID_OUTPUTS: OutputFormat[] = ['json', 'markdown', 'summary'];

/**
 * Load `.ugwtfrc.json` from the given directory (defaults to cwd).
 * Returns an empty object if the file doesn't exist or is malformed.
 */
export function loadRC(dir?: string): UGWTFRCConfig {
  const rcPath = join(dir ?? process.cwd(), '.ugwtfrc.json');
  if (!existsSync(rcPath)) return {};

  try {
    const raw = readFileSync(rcPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return validateRC(parsed);
  } catch {
    return {};
  }
}

/** Validate and extract only known fields with correct types. */
export function validateRC(raw: Record<string, unknown>): UGWTFRCConfig {
  const config: UGWTFRCConfig = {};

  if (Array.isArray(raw.defaultRepos) && raw.defaultRepos.every(r => typeof r === 'string')) {
    config.defaultRepos = raw.defaultRepos as string[];
  }
  if (typeof raw.dryRun === 'boolean') config.dryRun = raw.dryRun;
  if (typeof raw.verbose === 'boolean') config.verbose = raw.verbose;
  if (typeof raw.concurrency === 'number' && raw.concurrency >= 1 && Number.isInteger(raw.concurrency)) {
    config.concurrency = raw.concurrency;
  }
  if (typeof raw.output === 'string' && VALID_OUTPUTS.includes(raw.output as OutputFormat)) {
    config.output = raw.output as OutputFormat;
  }
  // G48: external repo registration via RC config
  if (Array.isArray(raw.repos)) {
    const valid = raw.repos.filter(
      (r): r is UGWTFRCConfig['repos'] extends Array<infer T> ? T : never =>
        typeof r === 'object' && r !== null &&
        typeof (r as Record<string, unknown>).slug === 'string' &&
        typeof (r as Record<string, unknown>).alias === 'string'
    );
    if (valid.length > 0) config.repos = valid;
  }

  return config;
}
