/**
 * Chain Generator — Builds prompt-chain.json from scanned prompts.
 *
 * Agent: chain-generator (clusterId: generate-chain)
 * Scans .prompt.md files, resolves dependencies, toposorts, outputs chain config.
 */
import type { Agent, AgentContext, AgentResult } from '../types.js';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join, basename, relative } from 'node:path';
import { scanAllPrompts, validatePrompt, type ParsedPrompt } from '../prompt/index.js';
import { writeFile } from '../utils/fs.js';
import { getRepo } from '../config/repo-registry.js';
import { type ChainEntry, type ChainConfig, CHAIN_CONFIG_FILENAME } from './chain-types.js';

// ---------------------------------------------------------------------------
// Agent 4: Chain Generator
// ---------------------------------------------------------------------------

/**
 * Derive a short prompt ID from a filename.
 * e.g. "01-supabase-client-setup.prompt.md" → "FI-01"
 * Falls back to numeric prefix or sequential index.
 */
function derivePromptId(fileName: string, index: number): string {
  const numMatch = fileName.match(/^(\d+)/);
  const num = numMatch ? numMatch[1]!.padStart(2, '0') : String(index + 1).padStart(2, '0');
  return `FI-${num}`;
}

/**
 * Map priority string to chain severity.
 */
function priorityToSeverity(priority: string | null): ChainEntry['severity'] {
  if (!priority) return 'medium';
  const n = parseInt(priority.replace(/^P/i, ''));
  if (n <= 0) return 'critical';
  if (n === 1) return 'high';
  if (n === 2) return 'medium';
  return 'low';
}

/**
 * Resolve dependency references to prompt IDs.
 * Handles: #N gap numbers (mapped by position), FI-XX IDs, filename refs.
 */
function resolveDeps(
  deps: string[],
  promptMap: Map<string, string>,     // fileName (no ext) → promptId
  gapToId: Map<string, string>,       // "#N" → promptId  (gap number = file prefix number)
): string[] {
  const resolved = new Set<string>();
  const unresolved: string[] = [];
  const knownIds = new Set(promptMap.values());

  for (const dep of deps) {
    let matched = false;

    // Direct prompt ID (FI-01 style)
    if (/^[A-Z]+-\d+$/.test(dep)) {
      if (knownIds.has(dep)) {
        resolved.add(dep);
        matched = true;
      }
    }

    // Gap number (#20 → look up which prompt has prefix 20)
    if (!matched && dep.startsWith('#')) {
      const id = gapToId.get(dep);
      if (id) {
        resolved.add(id);
        matched = true;
      }
    }

    // Filename ref (01-supabase-client-setup)
    if (!matched) {
      const id = promptMap.get(dep);
      if (id) {
        resolved.add(id);
        matched = true;
      }
    }

    if (!matched) {
      unresolved.push(dep);
    }
  }

  if (unresolved.length > 0) {
    console.warn(
      `[chain-agents] Dependency references could not be resolved and were skipped. Please verify dependency references: ${unresolved.join(', ')}`,
    );
  }

  return [...resolved];
}

/**
 * Kahn's algorithm: topological sort with cycle detection.
 * Returns sorted prompt IDs and computed wave assignments.
 */
function toposort(
  ids: string[],
  depGraph: Map<string, string[]>,
): { sorted: string[]; waves: Map<string, number> } {
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();  // dep → dependents

  for (const id of ids) {
    inDegree.set(id, 0);
    adjList.set(id, []);
  }

  for (const id of ids) {
    const deps = depGraph.get(id) ?? [];
    inDegree.set(id, deps.length);
    for (const dep of deps) {
      adjList.get(dep)?.push(id);
    }
  }

  // BFS
  const queue: string[] = [];
  const waves = new Map<string, number>();

  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      queue.push(id);
      waves.set(id, 1);
    }
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    const currentWave = waves.get(current)!;

    for (const dependent of adjList.get(current) ?? []) {
      const newDeg = inDegree.get(dependent)! - 1;
      inDegree.set(dependent, newDeg);

      // Wave = max(wave of all deps) + 1
      const existingWave = waves.get(dependent) ?? 0;
      waves.set(dependent, Math.max(existingWave, currentWave + 1));

      if (newDeg === 0) {
        queue.push(dependent);
      }
    }
  }

  if (sorted.length !== ids.length) {
    const missing = ids.filter(id => !sorted.includes(id));
    throw new Error(`Cycle detected in dependency graph! Involved prompts: ${missing.join(', ')}`);
  }

  return { sorted, waves };
}

const chainGenerator: Agent = {
  id: 'chain-generator',
  name: 'Chain Generator',
  description: 'Scan prompts, parse dependencies, toposort, and generate prompt-chain.json',
  clusterId: 'generate-chain',
  shouldRun() { return true; },

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const repoConfig = getRepo(ctx.repoAlias);
    if (!repoConfig) {
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: 0, message: 'Repo not found', artifacts: [] };
    }

    const localPath = ctx.localPath;
    ctx.logger.group(`Generating chain config for ${ctx.repoAlias}`);

    // 1. Scan all prompts (optionally scoped by --path)
    const allPrompts = await scanAllPrompts(localPath);
    let prompts = allPrompts;

    if (ctx.extras.path) {
      const target = join(localPath, ctx.extras.path);
      // Support both folder and single-file --path
      if (target.endsWith('.prompt.md') || target.endsWith('.md')) {
        prompts = allPrompts.filter(p => p.filePath === target);
      } else {
        prompts = allPrompts.filter(p => p.filePath.startsWith(target));
      }
      if (prompts.length === 0) {
        ctx.logger.warn(`No prompts found in --path ${ctx.extras.path} (${allPrompts.length} total in repo)`);
        ctx.logger.groupEnd();
        return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: `No prompts in ${ctx.extras.path}`, artifacts: [] };
      }
      ctx.logger.info(`Scoped to ${prompts.length} prompts from --path ${ctx.extras.path} (${allPrompts.length} total in repo)`);
    } else if (allPrompts.length === 0) {
      ctx.logger.warn('No prompts found — cannot generate chain');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: 'No prompts found', artifacts: [] };
    } else {
      ctx.logger.info(`Found ${allPrompts.length} prompts to chain`);
    }

    // 1b. Quality scoring — warn on low-scoring prompts
    const scores = prompts.map(p => validatePrompt(p));
    const avgScore = Math.round(scores.reduce((s, r) => s + r.percent, 0) / scores.length);
    const lowScoring = scores.filter(r => r.percent < 50);

    ctx.logger.info(`Prompt quality: avg ${avgScore}% (${lowScoring.length} below 50%)`);
    for (const r of lowScoring) {
      ctx.logger.warn(`  Low score: ${r.percent}% — ${r.prompt.fileName}`);
    }

    // 2. Sort prompts by filename for stable ordering
    const sorted = [...prompts].sort((a, b) => a.fileName.localeCompare(b.fileName));

    // 3. Build ID maps
    const promptMap = new Map<string, string>();   // fileName stem → prompt ID
    const gapToId = new Map<string, string>();     // "#N" → prompt ID (gap number = file prefix)
    const idToPrompt = new Map<string, ParsedPrompt>();

    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i]!;
      const id = derivePromptId(p.fileName, i);
      const stem = basename(p.fileName, '.prompt.md');
      promptMap.set(stem, id);
      idToPrompt.set(id, p);

      // Map gap numbers: file prefix "01" → "#1", "02" → "#2", etc.
      const numMatch = stem.match(/^(\d+)/);
      if (numMatch) {
        const num = parseInt(numMatch[1]!, 10);
        gapToId.set(`#${num}`, id);
      }
    }

    // 4. Resolve dependencies
    const depGraph = new Map<string, string[]>();
    const ids: string[] = [];

    for (const [id, p] of idToPrompt) {
      ids.push(id);
      const resolved = resolveDeps(p.depends, promptMap, gapToId);
      depGraph.set(id, resolved);
    }

    // 5. Toposort + wave assignment
    let topoResult: { sorted: string[]; waves: Map<string, number> };
    try {
      topoResult = toposort(ids, depGraph);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.logger.error(msg);
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: Date.now() - start, message: msg, artifacts: [] };
    }

    // 6. Build chain entries
    const chainEntries: ChainEntry[] = topoResult.sorted.map((id, i) => {
      const p = idToPrompt.get(id)!;
      const deps = depGraph.get(id) ?? [];
      return {
        position: i + 1,
        prompt: id,
        file: relative(localPath, p.filePath),
        wave: topoResult.waves.get(id) ?? 1,
        severity: priorityToSeverity(p.priority),
        depends: deps,
        issue: null,
        scope: p.scope ?? undefined,
        type: p.type ?? undefined,
      };
    });

    const totalWaves = new Set(chainEntries.map(e => e.wave)).size;

    // 7. Build config
    const config: ChainConfig = {
      version: 3,
      description: `Auto-generated chain for ${ctx.repoAlias} — ${chainEntries.length} prompts across ${totalWaves} waves`,
      repo: repoConfig.slug,
      labels: ['automation:copilot', 'agent:copilot', 'enhancement'],
      chain: chainEntries,
    };

    // 8. Write to scripts/prompt-chain.json
    const outputPath = join(localPath, 'scripts', CHAIN_CONFIG_FILENAME);

    if (ctx.dryRun) {
      ctx.logger.info('[DRY RUN] Would write chain config:');
      ctx.logger.info(`  Path: ${outputPath}`);
      ctx.logger.info(`  Entries: ${chainEntries.length}`);
      ctx.logger.info(`  Waves: ${totalWaves}`);
      for (const e of chainEntries) {
        const deps = e.depends.length > 0 ? ` → depends: [${e.depends.join(', ')}]` : '';
        ctx.logger.info(`  ${e.position}. ${e.prompt} (wave ${e.wave}, ${e.severity})${deps}`);
      }
      ctx.logger.groupEnd();
      return {
        agentId: this.id,
        status: 'success',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: `[DRY RUN] Would generate ${chainEntries.length} entries across ${totalWaves} waves`,
        artifacts: [],
      };
    }

    // Check if existing config has issues assigned (safety check)
    if (existsSync(outputPath)) {
      try {
        const existing = JSON.parse(readFileSync(outputPath, 'utf-8')) as ChainConfig;
        const hasIssues = existing.chain?.some(e => e.issue !== null);
        if (hasIssues) {
          ctx.logger.warn('Existing chain config has issues assigned — overwriting (old issues preserved in GitHub)');
        }
      } catch {
        // Existing file is malformed, overwrite is fine
      }
    }

    const result = writeFile(outputPath, JSON.stringify(config, null, 2) + '\n');
    ctx.logger.success(`${result.action === 'created' ? 'Created' : 'Updated'} ${outputPath}`);

    // Print summary
    ctx.logger.info('');
    ctx.logger.info(`Chain: ${chainEntries.length} prompts across ${totalWaves} waves`);
    for (const e of chainEntries) {
      const deps = e.depends.length > 0 ? ` → [${e.depends.join(', ')}]` : '';
      ctx.logger.info(`  ${e.position}. ${e.prompt} (W${e.wave} ${e.severity})${deps}`);
    }

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Generated ${chainEntries.length} entries across ${totalWaves} waves → ${outputPath}`,
      artifacts: [outputPath],
    };
  },
};

export const chainGeneratorAgents: Agent[] = [
  chainGenerator,
];
