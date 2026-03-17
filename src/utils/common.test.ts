import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseSlug, withRetry, parseJsonSafe, slugify } from './common.js';

describe('utils/common', () => {
  describe('parseSlug', () => {
    it('splits owner/repo correctly', () => {
      expect(parseSlug('DaBigHomie/maximus-ai')).toEqual({
        owner: 'DaBigHomie',
        repo: 'maximus-ai',
      });
    });

    it('handles slugs with multiple slashes (takes first two parts)', () => {
      const result = parseSlug('org/repo/extra');
      expect(result.owner).toBe('org');
      expect(result.repo).toBe('repo');
    });
  });

  describe('withRetry', () => {
    it('returns result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      const result = await withRetry(fn, 3, 10);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and succeeds eventually', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail1'))
        .mockResolvedValue('ok');

      const result = await withRetry(fn, 3, 1);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('throws after all attempts exhausted', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fails'));
      await expect(withRetry(fn, 1, 10)).rejects.toThrow('always fails');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('parseJsonSafe', () => {
    it('parses valid JSON', () => {
      expect(parseJsonSafe('{"key":"val"}')).toEqual({ key: 'val' });
    });

    it('returns null on invalid JSON', () => {
      expect(parseJsonSafe('not json')).toBeNull();
    });

    it('returns null on empty string', () => {
      expect(parseJsonSafe('')).toBeNull();
    });

    it('handles arrays', () => {
      expect(parseJsonSafe('[1,2,3]')).toEqual([1, 2, 3]);
    });
  });

  describe('slugify', () => {
    it('lowercases and replaces spaces with hyphens', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('strips non-alphanumeric characters', () => {
      expect(slugify('Test @#$ String!')).toBe('test-string');
    });

    it('collapses multiple hyphens', () => {
      expect(slugify('a---b---c')).toBe('a-b-c');
    });

    it('trims leading/trailing hyphens', () => {
      expect(slugify('  --hello--  ')).toBe('hello');
    });

    it('handles empty string', () => {
      expect(slugify('')).toBe('');
    });
  });
});
