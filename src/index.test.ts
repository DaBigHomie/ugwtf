import { describe, it, expect, vi, beforeEach } from 'vitest';

// parseArgs calls process.exit and console.error on bad input.
// We mock those to prevent test crashes.
const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
  throw new Error('process.exit called');
}) as never);
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

import { parseArgs } from './index.js';

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
});
