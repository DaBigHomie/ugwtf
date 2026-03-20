/**
 * Inline audit-orchestrator integrity spec.
 *
 * Checks:
 *   1. Directory structure — src/audit-orchestrator/ files present
 *   2. Type imports — agent/cluster use canonical types.ts (no ugwtf-types.ts)
 *   3. Runtime imports — visualAuditCluster and visualAuditAgents resolve
 *   4. Cluster correctness — id, agents, dependsOn
 *   5. No stale package dependency
 *
 * Rationale: prevents regression after bundling audit-orchestrator inline into src/.
 * Run with `npm test` (vitest) — part of the standard quality gate.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = resolve(import.meta.dirname!, '..');
const AUDIT_DIR = join(ROOT, 'src', 'audit-orchestrator');
const CANONICAL_TYPES = join(ROOT, 'src', 'types.ts');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract exported type/interface names from a .ts file */
function extractExportedNames(filePath: string): Set<string> {
  const src = readFileSync(filePath, 'utf-8');
  const names = new Set<string>();
  for (const m of src.matchAll(/^export\s+(?:type|interface)\s+(\w+)/gm)) {
    names.add(m[1]!);
  }
  return names;
}

/** Read JSON without import assertion hassle */
function readJSON(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

// ---------------------------------------------------------------------------
// 1. Directory structure
// ---------------------------------------------------------------------------

describe('inline: audit-orchestrator directory structure', () => {
  const EXPECTED_FILES = [
    'agent.ts',
    'cluster.ts',
    'ugwtf-plugin.ts',
    'index.ts',
    'types.ts',
    'scanner.ts',
    'prompt-scanner.ts',
    join('rules', 'index.ts'),
    join('adapters', 'index.ts'),
    join('reporters', 'index.ts'),
  ];

  for (const file of EXPECTED_FILES) {
    it(`src/audit-orchestrator/${file} exists`, () => {
      expect(existsSync(join(AUDIT_DIR, file))).toBe(true);
    });
  }

  it('ugwtf-types.ts is gone (replaced by canonical types.ts)', () => {
    expect(existsSync(join(AUDIT_DIR, 'ugwtf-types.ts'))).toBe(false);
  });

  it('packages/audit-orchestrator directory is gone', () => {
    expect(existsSync(join(ROOT, 'packages', 'audit-orchestrator'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Type contract — agent.ts/cluster.ts import from ../types.js
// ---------------------------------------------------------------------------

describe('inline: type imports use canonical types.ts', () => {
  const REQUIRED_TYPES = [
    'Agent',
    'AgentContext',
    'AgentResult',
    'AgentStatus',
    'AgentFinding',
    'Cluster',
    'UGWTFPlugin',
    'PluginRegistry',
  ] as const;

  const canonicalNames = extractExportedNames(CANONICAL_TYPES);

  it('canonical types.ts exports every required type', () => {
    for (const name of REQUIRED_TYPES) {
      expect(canonicalNames.has(name), `missing in types.ts: ${name}`).toBe(true);
    }
  });

  it('agent.ts imports from ../types.js not ugwtf-types.js', () => {
    const src = readFileSync(join(AUDIT_DIR, 'agent.ts'), 'utf-8');
    expect(src).toContain("from '../types.js'");
    expect(src).not.toContain("ugwtf-types");
  });

  it('cluster.ts imports from ../types.js not ugwtf-types.js', () => {
    const src = readFileSync(join(AUDIT_DIR, 'cluster.ts'), 'utf-8');
    expect(src).toContain("from '../types.js'");
    expect(src).not.toContain("ugwtf-types");
  });

  it('ugwtf-plugin.ts imports from ../types.js not ugwtf-types.js', () => {
    const src = readFileSync(join(AUDIT_DIR, 'ugwtf-plugin.ts'), 'utf-8');
    expect(src).toContain("from '../types.js'");
    expect(src).not.toContain("ugwtf-types");
  });
});

// ---------------------------------------------------------------------------
// 3. Runtime imports
// ---------------------------------------------------------------------------

describe('inline: runtime import', () => {
  it('visualAuditCluster resolves from src/audit-orchestrator/cluster.ts', async () => {
    const mod = await import('./audit-orchestrator/cluster.js');
    expect(mod).toBeDefined();
    expect(mod.visualAuditCluster).toBeDefined();
  });

  it('visualAuditAgents resolves from src/audit-orchestrator/agent.ts', async () => {
    const mod = await import('./audit-orchestrator/agent.js');
    expect(mod).toBeDefined();
    expect(mod.visualAuditAgents).toBeDefined();
  });

  it('plugin resolves from src/audit-orchestrator/ugwtf-plugin.ts', async () => {
    const mod = await import('./audit-orchestrator/ugwtf-plugin.js');
    expect(mod).toBeDefined();
    expect(mod.plugin).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Cluster correctness
// ---------------------------------------------------------------------------

describe('inline: visual-audit cluster properties', () => {
  it('has correct id, name, 10 agents, dependsOn quality', async () => {
    const { visualAuditCluster } = await import('./audit-orchestrator/cluster.js');
    expect(visualAuditCluster.id).toBe('visual-audit');
    expect(visualAuditCluster.name).toBeTruthy();
    expect(visualAuditCluster.agents).toHaveLength(10);
    expect(visualAuditCluster.dependsOn).toContain('quality');
  });
});

// ---------------------------------------------------------------------------
// 5. No stale package dependency
// ---------------------------------------------------------------------------

describe('inline: package.json has no audit-orchestrator dep', () => {
  const pkg = readJSON(join(ROOT, 'package.json'));

  it('@dabighomie/audit-orchestrator not in dependencies', () => {
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    expect(deps['@dabighomie/audit-orchestrator']).toBeUndefined();
  });

  it('@dabighomie/audit-orchestrator not in devDependencies', () => {
    const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
    expect(devDeps['@dabighomie/audit-orchestrator']).toBeUndefined();
  });

  it('has main field', () => {
    expect(pkg.main).toBe('dist/index.js');
  });

  it('has types field', () => {
    expect(pkg.types).toBe('dist/index.d.ts');
  });

  it('has files array including dist', () => {
    expect(Array.isArray(pkg.files)).toBe(true);
    expect((pkg.files as string[]).includes('dist')).toBe(true);
  });

  it('has prepublishOnly script', () => {
    const scripts = pkg.scripts as Record<string, string>;
    expect(scripts.prepublishOnly).toBeDefined();
  });
});
