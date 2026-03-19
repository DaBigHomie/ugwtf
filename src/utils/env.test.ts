import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from './env.js';

const TEST_DIR = join(import.meta.dirname, '../../.test-tmp-env');

describe('utils/env', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    // Clean up test env vars
    delete process.env.TEST_ENV_A;
    delete process.env.TEST_ENV_B;
    delete process.env.TEST_ENV_C;
    delete process.env.TEST_ENV_QUOTED;
    delete process.env.TEST_ENV_SINGLE;
  });

  it('returns 0 when .env file does not exist', () => {
    expect(loadEnv(TEST_DIR)).toBe(0);
  });

  it('parses KEY=value lines', () => {
    writeFileSync(join(TEST_DIR, '.env'), 'TEST_ENV_A=hello\nTEST_ENV_B=world\n');
    const count = loadEnv(TEST_DIR);
    expect(count).toBe(2);
    expect(process.env.TEST_ENV_A).toBe('hello');
    expect(process.env.TEST_ENV_B).toBe('world');
  });

  it('strips double quotes', () => {
    writeFileSync(join(TEST_DIR, '.env'), 'TEST_ENV_QUOTED="quoted value"\n');
    loadEnv(TEST_DIR);
    expect(process.env.TEST_ENV_QUOTED).toBe('quoted value');
  });

  it('strips single quotes', () => {
    writeFileSync(join(TEST_DIR, '.env'), "TEST_ENV_SINGLE='single quoted'\n");
    loadEnv(TEST_DIR);
    expect(process.env.TEST_ENV_SINGLE).toBe('single quoted');
  });

  it('skips comments and empty lines', () => {
    writeFileSync(join(TEST_DIR, '.env'), '# comment\n\nTEST_ENV_C=val\n  \n# another\n');
    const count = loadEnv(TEST_DIR);
    expect(count).toBe(1);
    expect(process.env.TEST_ENV_C).toBe('val');
  });

  it('does NOT overwrite existing env vars', () => {
    process.env.TEST_ENV_A = 'existing';
    writeFileSync(join(TEST_DIR, '.env'), 'TEST_ENV_A=overwritten\nTEST_ENV_B=new\n');
    const count = loadEnv(TEST_DIR);
    expect(count).toBe(1); // only B is new
    expect(process.env.TEST_ENV_A).toBe('existing');
    expect(process.env.TEST_ENV_B).toBe('new');
  });

  it('defaults to cwd when no dir provided', () => {
    // Just verify it doesn't throw when no arg is given
    const count = loadEnv();
    expect(typeof count).toBe('number');
  });
});
