import { describe, it, expect, vi, beforeEach } from 'vitest';

// parseArgs calls process.exit and console.error on bad input.
// We mock those to prevent test crashes.
const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
  throw new Error('process.exit called');
}) as never);
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

import { parseArgs } from './index.js';
import { parseListArgs } from './commands/list.js';
import { parseRunAgentArgs, findAgent } from './commands/run-agent.js';
import { loadRC, type UGWTFRCConfig } from './config/rc-loader.js';
import { InternalPluginRegistry } from './plugins/loader.js';
import { registerRepo, registerReposFromRC, getRepo, allAliases, type RepoConfig } from './config/repo-registry.js';
import { validateRepoOverrides, mergeRepoConfig, loadRepoConfig, type RepoConfigOverrides } from './config/repo-config-loader.js';

describe('parseArgs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for no arguments', () => {
    const result = parseArgs(['node', 'ugwtf']);
    expect(result).toBeNull();
  });

  it('returns null for --help', () => {
    const result = parseArgs(['node', 'ugwtf', '--help']);
    expect(result).toBeNull();
  });

  it('returns null for -h', () => {
    const result = parseArgs(['node', 'ugwtf', '-h']);
    expect(result).toBeNull();
  });

  it('parses basic command', () => {
    const result = parseArgs(['node', 'ugwtf', 'deploy']);
    expect(result).toEqual({
      command: 'deploy',
      repos: [],
      clusters: [],
      dryRun: false,
      verbose: false,
      concurrency: 3,
    });
  });

  it('parses --dry-run flag', () => {
    const result = parseArgs(['node', 'ugwtf', 'labels', '--dry-run']);
    expect(result?.dryRun).toBe(true);
  });

  it('parses --verbose flag', () => {
    const result = parseArgs(['node', 'ugwtf', 'audit', '--verbose']);
    expect(result?.verbose).toBe(true);
  });

  it('parses -v short flag', () => {
    const result = parseArgs(['node', 'ugwtf', 'audit', '-v']);
    expect(result?.verbose).toBe(true);
  });

  it('parses --concurrency value', () => {
    const result = parseArgs(['node', 'ugwtf', 'deploy', '--concurrency', '5']);
    expect(result?.concurrency).toBe(5);
  });

  it('parses --cluster flag', () => {
    const result = parseArgs(['node', 'ugwtf', 'deploy', '--cluster', 'labels']);
    expect(result?.clusters).toEqual(['labels']);
  });

  it('parses multiple --cluster flags', () => {
    const result = parseArgs(['node', 'ugwtf', 'deploy', '--cluster', 'labels', '--cluster', 'quality']);
    expect(result?.clusters).toEqual(['labels', 'quality']);
  });

  it('parses known repo aliases', () => {
    const result = parseArgs(['node', 'ugwtf', 'deploy', 'damieus']);
    expect(result?.repos).toContain('damieus');
  });

  it('parses combined options', () => {
    const result = parseArgs([
      'node', 'ugwtf', 'deploy', 'damieus', 'ffs',
      '--dry-run', '--verbose', '--concurrency', '2',
    ]);
    expect(result).toEqual({
      command: 'deploy',
      repos: ['damieus', 'ffs'],
      clusters: [],
      dryRun: true,
      verbose: true,
      concurrency: 2,
    });
  });

  it('exits on unknown command', () => {
    expect(() => parseArgs(['node', 'ugwtf', 'badcommand'])).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('exits on unknown repo alias', () => {
    expect(() => parseArgs(['node', 'ugwtf', 'deploy', 'notarepo'])).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('exits on unknown option', () => {
    expect(() => parseArgs(['node', 'ugwtf', 'deploy', '--nope'])).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('accepts all valid commands', () => {
    const commands = [
      'deploy', 'validate', 'fix', 'labels', 'issues', 'prs', 'audit', 'status',
      'prompts', 'chain', 'scan', 'security', 'performance', 'a11y', 'seo', 'docs',
      'commerce', 'scenarios', 'design-system', 'supabase', 'gateway',
    ];
    for (const cmd of commands) {
      const result = parseArgs(['node', 'ugwtf', cmd]);
      expect(result?.command).toBe(cmd);
    }
  });

  it('defaults concurrency to 3', () => {
    const result = parseArgs(['node', 'ugwtf', 'deploy']);
    expect(result?.concurrency).toBe(3);
  });

  // ── G18: --output flag tests ───────────────────────────────────────────

  it('parses --output json', () => {
    const result = parseArgs(['node', 'ugwtf', 'deploy', '--output', 'json']);
    expect(result?.output).toBe('json');
  });

  it('parses --output markdown', () => {
    const result = parseArgs(['node', 'ugwtf', 'deploy', '--output', 'markdown']);
    expect(result?.output).toBe('markdown');
  });

  it('parses --output summary', () => {
    const result = parseArgs(['node', 'ugwtf', 'deploy', '--output', 'summary']);
    expect(result?.output).toBe('summary');
  });

  it('exits on invalid --output value', () => {
    expect(() => parseArgs(['node', 'ugwtf', 'deploy', '--output', 'csv'])).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('output defaults to undefined', () => {
    const result = parseArgs(['node', 'ugwtf', 'deploy']);
    expect(result?.output).toBeUndefined();
  });
});

// ── G43: list command tests ────────────────────────────────────────────────

describe('parseListArgs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns "all" with no arguments', () => {
    expect(parseListArgs([])).toBe('all');
  });

  it('returns "clusters" target', () => {
    expect(parseListArgs(['clusters'])).toBe('clusters');
  });

  it('returns "agents" target', () => {
    expect(parseListArgs(['agents'])).toBe('agents');
  });

  it('returns "repos" target', () => {
    expect(parseListArgs(['repos'])).toBe('repos');
  });

  it('returns null for --help', () => {
    expect(parseListArgs(['--help'])).toBeNull();
  });

  it('exits on unknown target', () => {
    expect(() => parseListArgs(['badtarget'])).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});

// ── G44: run command tests ─────────────────────────────────────────────────

describe('parseRunAgentArgs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null for no arguments', () => {
    expect(parseRunAgentArgs([])).toBeNull();
  });

  it('returns null for --help', () => {
    expect(parseRunAgentArgs(['--help'])).toBeNull();
  });

  it('parses agent ID', () => {
    const result = parseRunAgentArgs(['label-sync']);
    expect(result?.agentId).toBe('label-sync');
    expect(result?.repos).toEqual([]);
    expect(result?.dryRun).toBe(false);
    expect(result?.verbose).toBe(false);
  });

  it('parses agent ID with repos and flags', () => {
    const result = parseRunAgentArgs(['label-sync', 'damieus', '--dry-run', '--verbose']);
    expect(result?.agentId).toBe('label-sync');
    expect(result?.repos).toContain('damieus');
    expect(result?.dryRun).toBe(true);
    expect(result?.verbose).toBe(true);
  });

  it('exits on unknown argument', () => {
    expect(() => parseRunAgentArgs(['label-sync', '--nope'])).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});

describe('findAgent', () => {
  it('finds an existing agent', () => {
    const agent = findAgent('label-sync');
    expect(agent).toBeDefined();
    expect(agent?.id).toBe('label-sync');
  });

  it('returns undefined for non-existent agent', () => {
    expect(findAgent('does-not-exist-xyz')).toBeUndefined();
  });
});

// ── G45: RC config tests ──────────────────────────────────────────────────

describe('loadRC', () => {
  it('returns empty object for non-existent directory', () => {
    const result = loadRC('/tmp/nonexistent-ugwtf-test-dir');
    expect(result).toEqual({});
  });
});

// ── G46/G47: Plugin system tests ──────────────────────────────────────────

describe('InternalPluginRegistry', () => {
  it('accumulates clusters', () => {
    const registry = new InternalPluginRegistry();
    const cluster = { id: 'test', name: 'Test', description: 'Test cluster', agents: [], dependsOn: [] };
    registry.addCluster(cluster);
    expect(registry.clusters).toHaveLength(1);
    expect(registry.clusters[0]!.id).toBe('test');
  });

  it('accumulates agents by cluster ID', () => {
    const registry = new InternalPluginRegistry();
    const agent = {
      id: 'test-agent', name: 'Test', description: 'desc', clusterId: 'test',
      execute: async () => ({ agentId: 'test-agent', status: 'success' as const, repo: '', duration: 0, message: '', artifacts: [] }),
      shouldRun: () => true,
    };
    registry.addAgent('test', agent);
    registry.addAgent('test', { ...agent, id: 'test-agent-2' });
    expect(registry.agents.get('test')).toHaveLength(2);
  });

  it('accumulates commands', () => {
    const registry = new InternalPluginRegistry();
    registry.addCommand('my-cmd', ['cluster-a', 'cluster-b']);
    expect(registry.commands.get('my-cmd')).toEqual(['cluster-a', 'cluster-b']);
  });
});

// ── G48: External repo registration ────────────────────────────────────────

describe('registerRepo', () => {
  const testAlias = '_test_g48_' + Date.now();

  it('registers a new repo at runtime', () => {
    const config: RepoConfig = {
      slug: 'TestOrg/test-repo',
      alias: testAlias,
      framework: 'node',
      supabaseProjectId: null,
      supabaseUrlSecret: null,
      supabaseServiceKeySecret: null,
      supabaseTypesPath: null,
      nodeVersion: '22',
      defaultBranch: 'main',
      hasE2E: false,
      e2eCommand: null,
      extraLabels: [],
      localPath: '/tmp/test-repo',
    };
    registerRepo(config);
    expect(getRepo(testAlias)).toEqual(config);
    expect(allAliases()).toContain(testAlias);
  });

  it('throws if alias already exists', () => {
    expect(() => registerRepo({
      slug: 'X/Y', alias: 'damieus', framework: 'node',
      supabaseProjectId: null, supabaseUrlSecret: null,
      supabaseServiceKeySecret: null, supabaseTypesPath: null,
      nodeVersion: '20', defaultBranch: 'main', hasE2E: false,
      e2eCommand: null, extraLabels: [], localPath: '/tmp',
    })).toThrow('already registered');
  });
});

describe('registerReposFromRC', () => {
  const rcAlias = '_test_rc_' + Date.now();

  it('registers repos from partial config array', () => {
    registerReposFromRC([
      { slug: 'Org/rc-repo', alias: rcAlias, framework: 'nextjs' },
    ]);
    const repo = getRepo(rcAlias);
    expect(repo).toBeDefined();
    expect(repo?.slug).toBe('Org/rc-repo');
    expect(repo?.framework).toBe('nextjs');
    expect(repo?.nodeVersion).toBe('20'); // default
  });

  it('skips entries without slug or alias', () => {
    const before = allAliases().length;
    registerReposFromRC([{ slug: 'X/Y' } as Partial<RepoConfig>]);
    expect(allAliases().length).toBe(before);
  });
});

// ── G49/G50: Per-repo config validation ────────────────────────────────────

describe('validateRepoOverrides', () => {
  it('extracts valid scalar overrides', () => {
    const result = validateRepoOverrides({
      nodeVersion: '22',
      framework: 'nextjs',
      defaultBranch: 'develop',
      hasE2E: true,
      e2eCommand: 'npx playwright test',
    });
    expect(result.nodeVersion).toBe('22');
    expect(result.framework).toBe('nextjs');
    expect(result.defaultBranch).toBe('develop');
    expect(result.hasE2E).toBe(true);
    expect(result.e2eCommand).toBe('npx playwright test');
  });

  it('rejects invalid framework values', () => {
    const result = validateRepoOverrides({ framework: 'django' });
    expect(result.framework).toBeUndefined();
  });

  it('accepts null for nullable fields', () => {
    const result = validateRepoOverrides({
      supabaseProjectId: null,
      e2eCommand: null,
    });
    expect(result.supabaseProjectId).toBeNull();
    expect(result.e2eCommand).toBeNull();
  });

  it('validates extraLabels array', () => {
    const result = validateRepoOverrides({
      extraLabels: [
        { name: 'valid', color: 'ff0000', description: 'A label' },
        { name: 123 }, // invalid
        'not-an-object', // invalid
      ],
    });
    expect(result.extraLabels).toHaveLength(1);
    expect(result.extraLabels![0]!.name).toBe('valid');
  });

  it('ignores unknown fields', () => {
    const result = validateRepoOverrides({ somethingElse: true, nodeVersion: '18' });
    expect(result.nodeVersion).toBe('18');
    expect((result as Record<string, unknown>).somethingElse).toBeUndefined();
  });
});

// ── G51: Merge config with defaults ────────────────────────────────────────

describe('mergeRepoConfig', () => {
  const base: RepoConfig = {
    slug: 'Org/base',
    alias: 'base',
    framework: 'vite-react',
    supabaseProjectId: 'abc123',
    supabaseUrlSecret: 'URL_BASE',
    supabaseServiceKeySecret: 'KEY_BASE',
    supabaseTypesPath: 'src/types.ts',
    nodeVersion: '20',
    defaultBranch: 'main',
    hasE2E: false,
    e2eCommand: null,
    extraLabels: [{ name: 'existing', color: '000000', description: 'Existing label' }],
    localPath: '/tmp/base',
  };

  it('replaces scalar fields', () => {
    const merged = mergeRepoConfig(base, { nodeVersion: '22', framework: 'nextjs' });
    expect(merged.nodeVersion).toBe('22');
    expect(merged.framework).toBe('nextjs');
    // unchanged fields
    expect(merged.slug).toBe('Org/base');
    expect(merged.defaultBranch).toBe('main');
  });

  it('appends new extraLabels without duplicates', () => {
    const merged = mergeRepoConfig(base, {
      extraLabels: [
        { name: 'new-label', color: 'ff0000', description: 'New' },
        { name: 'existing', color: '111111', description: 'Dup' }, // should be skipped
      ],
    });
    expect(merged.extraLabels).toHaveLength(2);
    expect(merged.extraLabels.map(l => l.name)).toEqual(['existing', 'new-label']);
    // Original color preserved for duplicate
    expect(merged.extraLabels.find(l => l.name === 'existing')?.color).toBe('000000');
  });

  it('does not mutate the original', () => {
    const merged = mergeRepoConfig(base, { nodeVersion: '22' });
    expect(base.nodeVersion).toBe('20');
    expect(merged.nodeVersion).toBe('22');
  });
});

describe('loadRepoConfig', () => {
  it('returns empty object for non-existent path', () => {
    const result = loadRepoConfig('/tmp/nonexistent-ugwtf-repo-config-test');
    expect(result).toEqual({});
  });
});
