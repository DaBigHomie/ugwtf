/**
 * C8: Integration tests — audit-orchestrator cluster runs in UGWTF pipeline
 *
 * Verifies that the visual-audit cluster from @dabighomie/audit-orchestrator
 * is properly registered, wired up, and processable by the UGWTF pipeline.
 */
import { describe, it, expect } from 'vitest';
import { CLUSTERS, getClusters, clusterExecutionOrder } from './clusters/index.js';
import { generateScoreboard } from './output/scoreboard.js';
import type { SwarmResult } from './types.js';

// ---------------------------------------------------------------------------
// C8.4: CLUSTERS array includes visual-audit
// ---------------------------------------------------------------------------

describe('integration: visual-audit cluster in CLUSTERS', () => {
  const visualAudit = CLUSTERS.find(c => c.id === 'visual-audit');

  it('CLUSTERS array contains a cluster with id "visual-audit"', () => {
    expect(visualAudit).toBeDefined();
  });

  // C8.2: Has expected agent count
  it('visual-audit cluster has 10 agents', () => {
    expect(visualAudit!.agents).toHaveLength(10);
  });

  // C8.2 cont: Has required metadata
  it('visual-audit cluster has name and description', () => {
    expect(visualAudit!.name).toBeTruthy();
    expect(visualAudit!.description).toBeTruthy();
  });

  // C8.2 cont: dependsOn includes quality
  it('visual-audit depends on "quality" cluster', () => {
    expect(visualAudit!.dependsOn).toContain('quality');
  });

  // C8.3: Each agent has execute() and shouldRun()
  it('every visual-audit agent has execute() and shouldRun() functions', () => {
    for (const agent of visualAudit!.agents) {
      expect(agent.id).toBeTruthy();
      expect(agent.name).toBeTruthy();
      expect(typeof agent.execute).toBe('function');
      expect(typeof agent.shouldRun).toBe('function');
    }
  });

  // C8.3 cont: All agents reference correct clusterId
  it('every visual-audit agent has clusterId "visual-audit"', () => {
    for (const agent of visualAudit!.agents) {
      expect(agent.clusterId).toBe('visual-audit');
    }
  });

  // C8.3 cont: No duplicate agent IDs within the cluster
  it('visual-audit agents have unique IDs', () => {
    const ids = visualAudit!.agents.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// C8.5: clusterExecutionOrder respects dependency graph
// ---------------------------------------------------------------------------

describe('integration: visual-audit execution ordering', () => {
  it('getClusters resolves visual-audit by ID', () => {
    const result = getClusters(['visual-audit']);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('visual-audit');
  });

  it('clusterExecutionOrder places quality before visual-audit', () => {
    // clusterExecutionOrder takes Cluster[], so gather both clusters
    const clusters = getClusters(['quality', 'visual-audit']);
    const waves = clusterExecutionOrder(clusters);
    const flatOrder = waves.flat().map(c => c.id);
    // quality must appear before visual-audit because visual-audit dependsOn: ['quality']
    expect(flatOrder).toContain('quality');
    expect(flatOrder).toContain('visual-audit');
    const qualityIdx = flatOrder.indexOf('quality');
    const vaIdx = flatOrder.indexOf('visual-audit');
    expect(qualityIdx).toBeLessThan(vaIdx);
  });

  it('clusterExecutionOrder includes quality in an earlier wave', () => {
    const clusters = getClusters(['quality', 'visual-audit']);
    const waves = clusterExecutionOrder(clusters);
    // waves is Cluster[][] — quality should be in an earlier wave index than visual-audit
    let qualityWave = -1;
    let vaWave = -1;
    for (let i = 0; i < waves.length; i++) {
      if (waves[i]!.some(c => c.id === 'quality')) qualityWave = i;
      if (waves[i]!.some(c => c.id === 'visual-audit')) vaWave = i;
    }
    expect(qualityWave).toBeGreaterThanOrEqual(0);
    expect(vaWave).toBeGreaterThanOrEqual(0);
    expect(qualityWave).toBeLessThan(vaWave);
  });
});

// ---------------------------------------------------------------------------
// C8.6: Scoreboard processes visual-audit cluster end-to-end
// ---------------------------------------------------------------------------

describe('integration: scoreboard with visual-audit data', () => {
  function makeMultiClusterResult(): SwarmResult {
    return {
      mode: 'sequential',
      startedAt: Date.now() - 2000,
      completedAt: Date.now(),
      results: [
        {
          repo: 'ffs',
          clusterResults: [
            {
              clusterId: 'quality',
              status: 'success',
              duration: 100,
              agentResults: [
                { agentId: 'tsc', status: 'success', repo: 'ffs', duration: 50, message: 'OK', artifacts: [] },
              ],
            },
            {
              clusterId: 'visual-audit',
              status: 'success',
              duration: 300,
              agentResults: [
                { agentId: 'va-lighthouse', status: 'success', repo: 'ffs', duration: 30, message: 'Score 92', artifacts: [] },
                { agentId: 'va-screenshot', status: 'success', repo: 'ffs', duration: 30, message: 'No diff', artifacts: [] },
                { agentId: 'va-responsive', status: 'failed', repo: 'ffs', duration: 30, message: 'Broken at 375px', artifacts: [], error: 'Layout break' },
              ],
            },
          ],
        },
        {
          repo: 'damieus',
          clusterResults: [
            {
              clusterId: 'visual-audit',
              status: 'success',
              duration: 200,
              agentResults: [
                { agentId: 'va-lighthouse', status: 'success', repo: 'damieus', duration: 30, message: 'Score 88', artifacts: [] },
                { agentId: 'va-screenshot', status: 'success', repo: 'damieus', duration: 30, message: 'No diff', artifacts: [] },
              ],
            },
          ],
        },
      ],
      summary: { totalAgents: 6, succeeded: 4, failed: 1, skipped: 0, duration: 2000 },
    };
  }

  it('generates per-repo scores including visual-audit agents', () => {
    const scoreboard = generateScoreboard(makeMultiClusterResult());
    expect(scoreboard.repos).toHaveLength(2);

    const ffs = scoreboard.repos.find(r => r.repo === 'ffs')!;
    // ffs: 1 quality (success) + 3 visual-audit (2 success, 1 failed) = total 4, passed 3
    expect(ffs.total).toBe(4);
    expect(ffs.passed).toBe(3);
    expect(ffs.failed).toBe(1);
    expect(ffs.score).toBe(75); // 3/4 = 75%

    const damieus = scoreboard.repos.find(r => r.repo === 'damieus')!;
    // damieus: 2 visual-audit (both success) = total 2, passed 2
    expect(damieus.total).toBe(2);
    expect(damieus.passed).toBe(2);
    expect(damieus.score).toBe(100);
  });

  it('overall score averages across repos correctly', () => {
    const scoreboard = generateScoreboard(makeMultiClusterResult());
    // ffs=75, damieus=100 → avg = 88 (rounded)
    expect(scoreboard.overallScore).toBe(88);
  });
});
