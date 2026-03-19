/**
 * Monorepo integrity spec — validates audit-orchestrator lives correctly inside ugwtf.
 *
 * Checks:
 *   1. Package resolution (file: link resolves)
 *   2. Type sync (ugwtf-types.ts mirrors canonical types.ts)
 *   3. Exports (all sub-path exports resolve)
 *   4. Build artifacts (dist/ present with expected files)
 *   5. No circular dependency
 *
 * Rationale: prevents silent drift between the two packages' type contracts.
 * Run with `npm test` (vitest) — part of the standard quality gate.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = resolve(import.meta.dirname!, '..');
const PKG_DIR = join(ROOT, 'packages', 'audit-orchestrator');
const CANONICAL_TYPES = join(ROOT, 'src', 'types.ts');
const LOCAL_TYPES = join(PKG_DIR, 'src', 'ugwtf-types.ts');
const SYMLINK = join(ROOT, 'node_modules', '@dabighomie', 'audit-orchestrator');

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
// 1. Package structure
// ---------------------------------------------------------------------------

describe('monorepo: package structure', () => {
  it('packages/audit-orchestrator directory exists', () => {
    expect(existsSync(PKG_DIR)).toBe(true);
  });

  it('symlink in node_modules points to packages/', () => {
    expect(existsSync(SYMLINK)).toBe(true);
    const target = realpathSync(SYMLINK);
    expect(target).toBe(realpathSync(PKG_DIR));
  });

  it('ugwtf package.json references file:./packages/audit-orchestrator', () => {
    const pkg = readJSON(join(ROOT, 'package.json'));
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@dabighomie/audit-orchestrator']).toBe(
      'file:./packages/audit-orchestrator',
    );
  });

  it('audit-orchestrator package.json has no circular ugwtf devDep', () => {
    const pkg = readJSON(join(PKG_DIR, 'package.json'));
    const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
    expect(devDeps['@dabighomie/ugwtf']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Type contract sync
// ---------------------------------------------------------------------------

describe('monorepo: type contract sync', () => {
  const canonicalNames = extractExportedNames(CANONICAL_TYPES);
  const localNames = extractExportedNames(LOCAL_TYPES);

  // Types that audit-orchestrator actually imports (the contract surface)
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

  it('canonical types.ts exports every required type', () => {
    for (const name of REQUIRED_TYPES) {
      expect(canonicalNames.has(name), `missing in types.ts: ${name}`).toBe(true);
    }
  });

  it('local ugwtf-types.ts exports every required type', () => {
    for (const name of REQUIRED_TYPES) {
      expect(localNames.has(name), `missing in ugwtf-types.ts: ${name}`).toBe(true);
    }
  });

  it('no required type was removed from canonical types.ts', () => {
    // If someone removes a type from ugwtf types.ts, this catches it
    for (const name of REQUIRED_TYPES) {
      expect(
        canonicalNames.has(name),
        `${name} deleted from canonical types.ts — audit-orchestrator depends on it`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Build artifacts
// ---------------------------------------------------------------------------

describe('monorepo: audit-orchestrator build', () => {
  const EXPECTED_DIST_FILES = [
    'index.js',
    'agent.js',
    'cluster.js',
    'ugwtf-plugin.js',
    'prompt-scanner.js',
    'types.js',
    'scanner.js',
    'ugwtf-types.js',
  ];

  for (const file of EXPECTED_DIST_FILES) {
    it(`dist/${file} exists`, () => {
      expect(existsSync(join(PKG_DIR, 'dist', file))).toBe(true);
    });
  }

  it('dist/ declaration files generated', () => {
    expect(existsSync(join(PKG_DIR, 'dist', 'index.d.ts'))).toBe(true);
    expect(existsSync(join(PKG_DIR, 'dist', 'agent.d.ts'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Exports map
// ---------------------------------------------------------------------------

describe('monorepo: audit-orchestrator exports', () => {
  const pkg = readJSON(join(PKG_DIR, 'package.json'));
  const exportMap = pkg.exports as Record<string, string>;

  const EXPECTED_EXPORTS = ['.', './agent', './cluster', './plugin', './prompt-scanner', './types'];

  for (const entry of EXPECTED_EXPORTS) {
    it(`exports "${entry}" is defined`, () => {
      expect(exportMap[entry]).toBeDefined();
    });

    it(`exports "${entry}" target file exists`, () => {
      const target = exportMap[entry] as string;
      expect(existsSync(join(PKG_DIR, target))).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// 5. Runtime import (dynamic — catches missing .js extensions, etc.)
// ---------------------------------------------------------------------------

describe('monorepo: runtime import', () => {
  it('default export resolves', async () => {
    const mod = await import('@dabighomie/audit-orchestrator');
    expect(mod).toBeDefined();
  });

  it('agent sub-path resolves', async () => {
    const mod = await import('@dabighomie/audit-orchestrator/agent');
    expect(mod).toBeDefined();
    expect(mod.visualAuditAgents).toBeDefined();
  });

  it('cluster sub-path resolves', async () => {
    const mod = await import('@dabighomie/audit-orchestrator/cluster');
    expect(mod).toBeDefined();
    expect(mod.visualAuditCluster).toBeDefined();
  });

  it('plugin sub-path resolves', async () => {
    const mod = await import('@dabighomie/audit-orchestrator/plugin');
    expect(mod).toBeDefined();
    expect(mod.plugin).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 6. ugwtf package.json npm-publish fields
// ---------------------------------------------------------------------------

describe('monorepo: ugwtf npm fields', () => {
  const pkg = readJSON(join(ROOT, 'package.json'));

  it('has main field', () => {
    expect(pkg.main).toBe('dist/index.js');
  });

  it('has types field', () => {
    expect(pkg.types).toBe('dist/index.d.ts');
  });

  it('has files array', () => {
    expect(Array.isArray(pkg.files)).toBe(true);
    expect((pkg.files as string[]).includes('dist')).toBe(true);
  });

  it('has prepublishOnly script', () => {
    const scripts = pkg.scripts as Record<string, string>;
    expect(scripts.prepublishOnly).toBeDefined();
  });
});
