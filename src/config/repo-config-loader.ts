/**
 * Per-Repo Config Loader (G49 / G50 / G51)
 *
 * Reads `ugwtf.config.json` from a repo's local path and merges
 * overrides into the repo-registry defaults.
 *
 * Supported overrides (G50):
 *   - nodeVersion: string
 *   - framework: Framework
 *   - extraLabels: LabelDef[]
 *   - defaultBranch: string
 *   - hasE2E: boolean
 *   - e2eCommand: string | null
 *   - supabaseProjectId: string | null
 *   - supabaseTypesPath: string | null
 *
 * Schema (`ugwtf.config.json` in repo root):
 * ```json
 * {
 *   "nodeVersion": "22",
 *   "framework": "nextjs",
 *   "extraLabels": [{ "name": "my-label", "color": "ff0000", "description": "Custom" }]
 * }
 * ```
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { RepoConfig, Framework, LabelDef } from './repo-registry.js';

const CONFIG_FILENAME = 'ugwtf.config.json';
const VALID_FRAMEWORKS: Framework[] = ['vite-react', 'nextjs', 'node'];

/** Fields that can be overridden via per-repo config. */
export interface RepoConfigOverrides {
  nodeVersion?: string;
  framework?: Framework;
  extraLabels?: LabelDef[];
  defaultBranch?: string;
  hasE2E?: boolean;
  e2eCommand?: string | null;
  supabaseProjectId?: string | null;
  supabaseTypesPath?: string | null;
}

/**
 * Load `ugwtf.config.json` from a repo's local path.
 * Returns only validated override fields.
 */
export function loadRepoConfig(repoLocalPath: string): RepoConfigOverrides {
  const configPath = join(repoLocalPath, CONFIG_FILENAME);
  if (!existsSync(configPath)) return {};

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return validateRepoOverrides(parsed);
  } catch {
    return {};
  }
}

/** Validate and extract only known override fields with correct types. */
export function validateRepoOverrides(raw: Record<string, unknown>): RepoConfigOverrides {
  const overrides: RepoConfigOverrides = {};

  if (typeof raw.nodeVersion === 'string' && raw.nodeVersion.length > 0) {
    overrides.nodeVersion = raw.nodeVersion;
  }
  if (typeof raw.framework === 'string' && VALID_FRAMEWORKS.includes(raw.framework as Framework)) {
    overrides.framework = raw.framework as Framework;
  }
  if (typeof raw.defaultBranch === 'string' && raw.defaultBranch.length > 0) {
    overrides.defaultBranch = raw.defaultBranch;
  }
  if (typeof raw.hasE2E === 'boolean') {
    overrides.hasE2E = raw.hasE2E;
  }
  if (raw.e2eCommand === null || typeof raw.e2eCommand === 'string') {
    overrides.e2eCommand = raw.e2eCommand;
  }
  if (raw.supabaseProjectId === null || typeof raw.supabaseProjectId === 'string') {
    overrides.supabaseProjectId = raw.supabaseProjectId;
  }
  if (raw.supabaseTypesPath === null || typeof raw.supabaseTypesPath === 'string') {
    overrides.supabaseTypesPath = raw.supabaseTypesPath;
  }

  // extraLabels must be an array of valid LabelDef objects
  if (Array.isArray(raw.extraLabels)) {
    const valid = raw.extraLabels.filter(
      (l): l is LabelDef =>
        typeof l === 'object' && l !== null &&
        typeof (l as Record<string, unknown>).name === 'string' &&
        typeof (l as Record<string, unknown>).color === 'string' &&
        typeof (l as Record<string, unknown>).description === 'string'
    );
    if (valid.length > 0) overrides.extraLabels = valid;
  }

  return overrides;
}

/**
 * Merge per-repo config overrides into a RepoConfig (G51).
 *
 * - Scalar fields are replaced.
 * - `extraLabels` are APPENDED (repo-registry defaults + file overrides).
 * - Returns a new object; the original is not mutated.
 */
export function mergeRepoConfig(base: RepoConfig, overrides: RepoConfigOverrides): RepoConfig {
  const merged = { ...base };

  if (overrides.nodeVersion !== undefined) merged.nodeVersion = overrides.nodeVersion;
  if (overrides.framework !== undefined) merged.framework = overrides.framework;
  if (overrides.defaultBranch !== undefined) merged.defaultBranch = overrides.defaultBranch;
  if (overrides.hasE2E !== undefined) merged.hasE2E = overrides.hasE2E;
  if (overrides.e2eCommand !== undefined) merged.e2eCommand = overrides.e2eCommand;
  if (overrides.supabaseProjectId !== undefined) merged.supabaseProjectId = overrides.supabaseProjectId;
  if (overrides.supabaseTypesPath !== undefined) merged.supabaseTypesPath = overrides.supabaseTypesPath;

  // Append extra labels (deduplicate by name)
  if (overrides.extraLabels) {
    const existingNames = new Set(merged.extraLabels.map(l => l.name));
    const newLabels = overrides.extraLabels.filter(l => !existingNames.has(l.name));
    merged.extraLabels = [...merged.extraLabels, ...newLabels];
  }

  return merged;
}

/**
 * Resolve a repo's effective config by loading per-repo overrides and merging.
 * Convenience function combining loadRepoConfig + mergeRepoConfig.
 */
export function resolveRepoConfig(base: RepoConfig): RepoConfig {
  const overrides = loadRepoConfig(base.localPath);
  if (Object.keys(overrides).length === 0) return base;
  return mergeRepoConfig(base, overrides);
}
