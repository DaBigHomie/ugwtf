import { describe, it, expect } from 'vitest';
import { CLUSTERS, getClusters, clusterExecutionOrder } from '../clusters/index.js';

describe('clusters/index', () => {
  describe('CLUSTERS', () => {
    it('is a non-empty array', () => {
      expect(CLUSTERS.length).toBeGreaterThan(0);
    });

    it('all clusters have required fields', () => {
      for (const cluster of CLUSTERS) {
        expect(cluster.id).toBeTruthy();
        expect(cluster.name).toBeTruthy();
        expect(cluster.description).toBeTruthy();
        expect(Array.isArray(cluster.agents)).toBe(true);
        expect(Array.isArray(cluster.dependsOn)).toBe(true);
      }
    });

    it('has no duplicate cluster IDs', () => {
      const ids = CLUSTERS.map(c => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('dependency references exist', () => {
      const ids = new Set(CLUSTERS.map(c => c.id));
      for (const cluster of CLUSTERS) {
        for (const dep of cluster.dependsOn) {
          expect(ids.has(dep)).toBe(true);
        }
      }
    });
  });

  describe('getClusters', () => {
    it('returns clusters by ID', () => {
      const result = getClusters(['labels']);
      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe('labels');
    });

    it('filters to only requested IDs', () => {
      const result = getClusters(['labels', 'quality']);
      expect(result.length).toBe(2);
      const ids = result.map(c => c.id);
      expect(ids).toContain('labels');
      expect(ids).toContain('quality');
    });

    it('ignores unknown IDs', () => {
      const result = getClusters(['labels', 'nonexistent']);
      expect(result.length).toBe(1);
    });

    it('returns all clusters for empty input', () => {
      expect(getClusters([]).length).toBe(CLUSTERS.length);
    });
  });

  describe('clusterExecutionOrder', () => {
    it('returns at least one wave for clusters with no deps', () => {
      const noDeps = CLUSTERS.filter(c => c.dependsOn.length === 0);
      if (noDeps.length > 0) {
        const waves = clusterExecutionOrder(noDeps);
        expect(waves.length).toBeGreaterThan(0);
        // First wave should contain all passed clusters (no deps to wait for)
        expect(waves[0]?.length).toBe(noDeps.length);
      }
    });

    it('respects dependency ordering', () => {
      // Get a dependent cluster pair (workflows depends on labels)
      const labels = CLUSTERS.find(c => c.id === 'labels');
      const workflows = CLUSTERS.find(c => c.id === 'workflows');
      if (labels && workflows) {
        const waves = clusterExecutionOrder([labels, workflows]);
        // labels should be in an earlier wave than workflows
        let labelsWave = -1;
        let workflowsWave = -1;
        for (let i = 0; i < waves.length; i++) {
          if (waves[i]?.some(c => c.id === 'labels')) labelsWave = i;
          if (waves[i]?.some(c => c.id === 'workflows')) workflowsWave = i;
        }
        expect(labelsWave).toBeLessThan(workflowsWave);
      }
    });

    it('handles all clusters without error', () => {
      const waves = clusterExecutionOrder(CLUSTERS);
      expect(waves.length).toBeGreaterThan(0);
      // Every cluster should appear in exactly one wave
      const allIds = waves.flat().map(c => c.id);
      expect(new Set(allIds).size).toBe(CLUSTERS.length);
    });
  });
});
