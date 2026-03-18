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
