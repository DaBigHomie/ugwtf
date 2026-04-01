/**
 * Chain Types — Shared types, constants, and validation for chain agents.
 *
 * Extracted from chain-agents.ts to reduce file size for agent readability.
 * Contains: ChainEntry, ChainConfig, resolveChainPath, validateChainConfig,
 *           severityToLabel, buildChainIssueBody, getUgwtfRoot
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getRepo } from '../config/repo-registry.js';

// ---------------------------------------------------------------------------
// Chain Schema Types
// ---------------------------------------------------------------------------

export interface ChainEntry {
  position: number;
  prompt: string;
  file: string;
  wave: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  depends: string[];
  issue: number | null;
  specIssue?: number | null;  // SP (spec) issue number — bridges CH↔SP layers
  scope?: string;   // from prompt YAML frontmatter (e.g. "shop", "marketing")
  type?: string;    // from prompt YAML frontmatter (e.g. "feat", "fix", "perf")
}

export interface ChainConfig {
  version: number;
  description: string;
  repo: string;
  labels: string[];
  chain: ChainEntry[];
}
// ---------------------------------------------------------------------------
// Chain Config Path Convention
// ---------------------------------------------------------------------------

export const CHAIN_CONFIG_FILENAME = 'prompt-chain.json';

/**
 * Detect the ugwtf repo root directory.
 *
 * Resolution order:
 *   1. The ugwtf entry in the repo registry (`localPath`)
 *   2. `process.cwd()` if it contains `projects/` (i.e. we're running from ugwtf checkout)
 *
 * Returns `null` when the ugwtf root cannot be determined.
 */
export function getUgwtfRoot(): string | null {
  // 1. Registry entry
  const ugwtfConfig = getRepo('ugwtf');
  if (ugwtfConfig?.localPath && existsSync(join(ugwtfConfig.localPath, 'projects'))) {
    return ugwtfConfig.localPath;
  }

  // 2. cwd fallback (covers CI / GitHub web where cwd IS the ugwtf checkout)
  const cwd = process.cwd();
  if (existsSync(join(cwd, 'projects'))) {
    return cwd;
  }

  return null;
}

/**
 * Resolve the chain config path for a repo.
 *
 * Candidate order:
 *   1. `<localPath>/scripts/prompt-chain.json`  — target repo's own scripts dir
 *   2. `<localPath>/prompt-chain.json`           — target repo root
 *   3. `<localPath>/.github/prompt-chain.json`   — target repo .github dir
 *   4. `<ugwtfRoot>/projects/<alias>/prompt-chain.json` — centrally stored in ugwtf
 *
 * The fourth candidate (project-specific fallback) only activates when
 * `repoAlias` is provided and the ugwtf root can be located.
 */
export function resolveChainPath(localPath: string, repoAlias?: string): string | null {
  const candidates = [
    join(localPath, 'scripts', CHAIN_CONFIG_FILENAME),
    join(localPath, CHAIN_CONFIG_FILENAME),
    join(localPath, '.github', CHAIN_CONFIG_FILENAME),
  ];

  // Add ugwtf projects/<alias> fallback when repoAlias is available
  if (repoAlias) {
    const ugwtfRoot = getUgwtfRoot();
    if (ugwtfRoot) {
      candidates.push(join(ugwtfRoot, 'projects', repoAlias, CHAIN_CONFIG_FILENAME));
    }
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Validate chain config structure.
 * Returns list of validation errors (empty = valid).
 */
export function validateChainConfig(config: unknown): string[] {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return ['Chain config is not a valid object'];
  }

  const c = config as Record<string, unknown>;

  if (typeof c.version !== 'number') errors.push('Missing or invalid "version" (must be number)');
  if (typeof c.repo !== 'string') errors.push('Missing or invalid "repo" (must be string)');
  if (!Array.isArray(c.labels)) errors.push('Missing or invalid "labels" (must be array)');
  if (!Array.isArray(c.chain)) {
    errors.push('Missing or invalid "chain" (must be array)');
    return errors;
  }

  const positions = new Set<number>();
  const prompts = new Set<string>();

  for (let i = 0; i < (c.chain as unknown[]).length; i++) {
    const entry = (c.chain as unknown[])[i] as Record<string, unknown>;
    const prefix = `chain[${i}]`;

    if (typeof entry.position !== 'number') errors.push(`${prefix}: missing position`);
    if (typeof entry.prompt !== 'string') errors.push(`${prefix}: missing prompt ID`);
    if (typeof entry.file !== 'string') errors.push(`${prefix}: missing file path`);
    if (typeof entry.wave !== 'number') errors.push(`${prefix}: missing wave`);

    const validSeverities = ['critical', 'high', 'medium', 'low'];
    if (!validSeverities.includes(entry.severity as string)) {
      errors.push(`${prefix}: invalid severity "${String(entry.severity)}"`);
    }

    if (!Array.isArray(entry.depends)) errors.push(`${prefix}: depends must be array`);

    if (typeof entry.position === 'number') {
      if (positions.has(entry.position)) errors.push(`${prefix}: duplicate position ${entry.position}`);
      positions.add(entry.position);
    }
    if (typeof entry.prompt === 'string') {
      if (prompts.has(entry.prompt)) errors.push(`${prefix}: duplicate prompt "${entry.prompt}"`);
      prompts.add(entry.prompt);
    }
  }

  // Validate dependency references
  for (const entry of c.chain as Array<Record<string, unknown>>) {
    if (Array.isArray(entry.depends)) {
      for (const dep of entry.depends as string[]) {
        if (!prompts.has(dep)) {
          errors.push(`${String(entry.prompt)}: depends on unknown prompt "${dep}"`);
        }
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Agent 2: Chain Issue Creator
// ---------------------------------------------------------------------------

/**
 * Severity → priority label mapping
 */
export function severityToLabel(severity: string): string {
  switch (severity) {
    case 'critical': return 'priority:p0';
    case 'high':     return 'priority:p1';
    case 'medium':   return 'priority:p2';
    case 'low':      return 'priority:p3';
    default:         return 'priority:p2';
  }
}

/**
 * Build issue body from chain entry
 */
export function buildChainIssueBody(entry: ChainEntry, config: ChainConfig): string {
  const deps = entry.depends.length > 0
    ? entry.depends.map(d => {
        const depEntry = config.chain.find(e => e.prompt === d);
        return depEntry?.issue ? `- #${depEntry.issue} (${d})` : `- ${d} (no issue yet)`;
      }).join('\n')
    : '_None_';

  return [
    `## Prompt Chain — Position ${entry.position} / ${config.chain.length}`,
    '',
    `**Prompt**: \`${entry.prompt}\``,
    `**File**: \`${entry.file}\``,
    `**Wave**: ${entry.wave} | **Severity**: ${entry.severity}`,
    '',
    '### Dependencies',
    deps,
    '',
    '### Instructions',
    `Read the prompt file at \`${entry.file}\` and implement all changes described.`,
    '',
    '### Chain Context',
    `This is position ${entry.position} of ${config.chain.length} in the prompt chain.`,
    entry.position < config.chain.length
      ? `After this is complete, the next prompt in the chain will be activated.`
      : `This is the **final** prompt in the chain.`,
    '',
    '---',
    `_Auto-generated by UGWTF chain agent v2.0_`,
  ].join('\n');
}

