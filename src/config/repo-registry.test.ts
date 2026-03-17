import { describe, it, expect } from 'vitest';
import { getRepo, allAliases, REPOS, UNIVERSAL_LABELS } from '../config/repo-registry.js';

describe('config/repo-registry', () => {
  describe('allAliases', () => {
    it('returns an array of strings', () => {
      const aliases = allAliases();
      expect(Array.isArray(aliases)).toBe(true);
      expect(aliases.length).toBeGreaterThan(0);
      for (const a of aliases) {
        expect(typeof a).toBe('string');
      }
    });

    it('includes known repos', () => {
      const aliases = allAliases();
      expect(aliases).toContain('damieus');
      expect(aliases).toContain('ffs');
      expect(aliases).toContain('043');
      expect(aliases).toContain('maximus');
      expect(aliases).toContain('cae');
    });
  });

  describe('getRepo', () => {
    it('returns config by alias', () => {
      const repo = getRepo('damieus');
      expect(repo).toBeDefined();
      expect(repo?.alias).toBe('damieus');
      expect(repo?.slug).toBe('DaBigHomie/damieus-com-migration');
    });

    it('returns config by slug', () => {
      const repo = getRepo('DaBigHomie/damieus-com-migration');
      expect(repo).toBeDefined();
      expect(repo?.alias).toBe('damieus');
    });

    it('returns undefined for unknown alias', () => {
      expect(getRepo('nonexistent')).toBeUndefined();
    });

    it('all repos have required fields', () => {
      for (const alias of allAliases()) {
        const repo = getRepo(alias);
        expect(repo).toBeDefined();
        expect(repo?.slug).toBeTruthy();
        expect(repo?.framework).toMatch(/^(vite-react|nextjs|node)$/);
        expect(repo?.nodeVersion).toBeTruthy();
        expect(repo?.defaultBranch).toBeTruthy();
        expect(repo?.localPath).toBeTruthy();
      }
    });
  });

  describe('REPOS', () => {
    it('is a non-empty object', () => {
      expect(Object.keys(REPOS).length).toBeGreaterThan(0);
    });

    it('each repo has consistent alias key', () => {
      for (const [key, repo] of Object.entries(REPOS)) {
        expect(repo.alias).toBe(key);
      }
    });
  });

  describe('UNIVERSAL_LABELS', () => {
    it('is a non-empty array', () => {
      expect(UNIVERSAL_LABELS.length).toBeGreaterThan(0);
    });

    it('all labels have name, color, description', () => {
      for (const label of UNIVERSAL_LABELS) {
        expect(label.name).toBeTruthy();
        expect(label.color).toMatch(/^[0-9a-fA-F]{6}$/);
        expect(label.description).toBeTruthy();
      }
    });

    it('has no duplicate label names', () => {
      const names = UNIVERSAL_LABELS.map(l => l.name);
      expect(new Set(names).size).toBe(names.length);
    });
  });
});
