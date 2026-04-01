/**
 * Prompt Agents — Unit Tests
 *
 * Tests the 24-point gold-standard validatePrompt() scoring,
 * parseDependencies(), scanAllPrompts(), and agent behavior.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import {
  type ParsedPrompt,
  type ValidationResult,
  validatePrompt,
  parseDependencies,
  scanAllPrompts,
  clearPromptScanCache,
} from '../prompt/index.js';
import { promptAgents, promptFixerAgents } from './prompt-agents.js';

// ---------------------------------------------------------------------------
// Helpers — build ParsedPrompt objects for targeted scoring tests
// ---------------------------------------------------------------------------

const FIXTURES_DIR = join(import.meta.dirname, '../../tests/fixtures/test-repo');

/** Minimal prompt with all fields empty/false — scores near 0 */
function emptyPrompt(overrides: Partial<ParsedPrompt> = {}): ParsedPrompt {
  return {
    filePath: '/fake/test.prompt.md',
    fileName: 'test.prompt.md',
    format: 'B',
    title: '',
    priority: null,
    status: null,
    estimatedTime: null,
    agentType: null,
    revenueImpact: null,
    objective: null,
    hasSuccessCriteria: false,
    hasTestingChecklist: false,
    hasDatabaseSchema: false,
    hasReferenceImpl: false,
    hasCodeExamples: false,
    hasFilesToModify: false,
    hasTags: false,
    hasEnvironment: false,
    hasBlockingGate: false,
    hasMergeGate: false,
    hasBlastRadius: false,
    hasA11y: false,
    hasDesignSystem: false,
    hasTestIdContracts: false,
    hasAgentBootstrap: false,
    hasWorkflowLifecycle: false,
    tags: [],
    filesToModify: [],
    sections: [],
    checklistItems: 0,
    totalLines: 10,
    depends: [],
    raw: '',
    ...overrides,
  };
}

/** A "perfect" Format B prompt that should score 100/100 */
function perfectPrompt(overrides: Partial<ParsedPrompt> = {}): ParsedPrompt {
  return {
    filePath: '/fake/perfect.prompt.md',
    fileName: 'perfect.prompt.md',
    format: 'B',
    title: 'Setup Database Schema for Ecommerce',
    priority: 'P0',
    status: 'READY TO START',
    estimatedTime: '4 hours',
    agentType: 'Database Agent',
    revenueImpact: 'High — enables checkout flow',
    objective: 'Create the full database schema including products, orders, and users tables with RLS policies.',
    hasSuccessCriteria: true,
    hasTestingChecklist: true,
    hasDatabaseSchema: true,
    hasReferenceImpl: true,
    hasCodeExamples: true,
    hasFilesToModify: true,
    hasTags: true,
    hasEnvironment: true,
    hasBlockingGate: true,
    hasMergeGate: true,
    hasBlastRadius: true,
    hasA11y: true,
    hasDesignSystem: true,
    hasTestIdContracts: true,
    hasAgentBootstrap: true,
    hasWorkflowLifecycle: true,
    tags: ['type:feat', 'scope:db'],
    filesToModify: ['src/lib/supabase/schema.ts'],
    sections: ['Objective', 'Success Criteria', 'Testing Checklist', 'Implementation'],
    checklistItems: 5,
    totalLines: 120,
    depends: ['#1'],
    raw: '# PROMPT: Setup Database Schema...',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// validatePrompt — 24-point scoring
// ═══════════════════════════════════════════════════════════════════════════

describe('validatePrompt', () => {
  it('scores a perfect prompt at 100%', () => {
    const result = validatePrompt(perfectPrompt());
    expect(result.percent).toBe(100);
    expect(result.score).toBe(149);
    expect(result.maxScore).toBe(149);
    expect(result.criteria).toHaveLength(24);
  });

  it('scores an empty Format B prompt near minimum', () => {
    const result = validatePrompt(emptyPrompt());
    // Empty title = 0, no priority = 0, no objective = 0, no sections = 0,
    // no success = 0, no testing = 0, no code = 0, no time = 0, no revenue = 0,
    // no checklists = 0, no ref = 0, depth 10 lines = 1
    expect(result.percent).toBeLessThanOrEqual(5);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  // ----- Criterion 1: Title (10 pts) -----
  describe('criterion 1: Title', () => {
    it('awards 10 pts for clear title (6-119 chars)', () => {
      const result = validatePrompt(emptyPrompt({ title: 'Setup Foundation Layer' }));
      const titleC = result.criteria.find(c => c.name === 'Title')!;
      expect(titleC.points).toBe(10);
    });

    it('awards 5 pts for very short title (1-5 chars)', () => {
      const result = validatePrompt(emptyPrompt({ title: 'Fix' }));
      const titleC = result.criteria.find(c => c.name === 'Title')!;
      expect(titleC.points).toBe(5);
    });

    it('awards 0 pts for empty title', () => {
      const result = validatePrompt(emptyPrompt({ title: '' }));
      const titleC = result.criteria.find(c => c.name === 'Title')!;
      expect(titleC.points).toBe(0);
    });

    it('awards 5 pts for title >= 120 chars', () => {
      const result = validatePrompt(emptyPrompt({ title: 'A'.repeat(120) }));
      const titleC = result.criteria.find(c => c.name === 'Title')!;
      expect(titleC.points).toBe(5);
    });
  });

  // ----- Criterion 2: Priority (10 pts) -----
  describe('criterion 2: Priority', () => {
    it('awards 10 pts when priority is set (Format B)', () => {
      const result = validatePrompt(emptyPrompt({ priority: 'P1' }));
      const c = result.criteria.find(c => c.name === 'Priority')!;
      expect(c.points).toBe(10);
    });

    it('awards 0 pts when priority missing (Format B)', () => {
      const result = validatePrompt(emptyPrompt({ priority: null, format: 'B' }));
      const c = result.criteria.find(c => c.name === 'Priority')!;
      expect(c.points).toBe(0);
    });

    it('awards 5 pts partial credit for Format A (no priority system)', () => {
      const result = validatePrompt(emptyPrompt({ format: 'A', priority: null }));
      const c = result.criteria.find(c => c.name === 'Priority')!;
      expect(c.points).toBe(5);
    });
  });

  // ----- Criterion 3: Objective (15 pts) -----
  describe('criterion 3: Objective', () => {
    it('awards 15 pts for detailed objective (>20 chars)', () => {
      const result = validatePrompt(emptyPrompt({ objective: 'Create the full database schema including products and orders.' }));
      const c = result.criteria.find(c => c.name === 'Objective')!;
      expect(c.points).toBe(15);
    });

    it('awards 8 pts for brief objective (1-20 chars)', () => {
      const result = validatePrompt(emptyPrompt({ objective: 'Setup DB schema' }));
      const c = result.criteria.find(c => c.name === 'Objective')!;
      expect(c.points).toBe(8);
    });

    it('awards 0 pts for missing objective', () => {
      const result = validatePrompt(emptyPrompt({ objective: null }));
      const c = result.criteria.find(c => c.name === 'Objective')!;
      expect(c.points).toBe(0);
    });
  });

  // ----- Criterion 4: Sections (10 pts) -----
  describe('criterion 4: Sections', () => {
    it('awards 10 pts for >=4 sections', () => {
      const result = validatePrompt(emptyPrompt({ sections: ['A', 'B', 'C', 'D'] }));
      const c = result.criteria.find(c => c.name === 'Sections')!;
      expect(c.points).toBe(10);
    });

    it('awards 6 pts for 2-3 sections', () => {
      const result = validatePrompt(emptyPrompt({ sections: ['A', 'B'] }));
      const c = result.criteria.find(c => c.name === 'Sections')!;
      expect(c.points).toBe(6);
    });

    it('awards 3 pts for 1 section', () => {
      const result = validatePrompt(emptyPrompt({ sections: ['A'] }));
      const c = result.criteria.find(c => c.name === 'Sections')!;
      expect(c.points).toBe(3);
    });

    it('awards 0 pts for 0 sections', () => {
      const result = validatePrompt(emptyPrompt({ sections: [] }));
      const c = result.criteria.find(c => c.name === 'Sections')!;
      expect(c.points).toBe(0);
    });
  });

  // ----- Criterion 5-7: Boolean flags -----
  describe('criterion 5-7: Success/Testing/Code flags', () => {
    it('awards 10 pts each for success criteria, testing, code examples', () => {
      const result = validatePrompt(emptyPrompt({
        hasSuccessCriteria: true,
        hasTestingChecklist: true,
        hasCodeExamples: true,
      }));
      expect(result.criteria.find(c => c.name === 'Success Criteria')!.points).toBe(10);
      expect(result.criteria.find(c => c.name === 'Testing Checklist')!.points).toBe(10);
      expect(result.criteria.find(c => c.name === 'Code Examples')!.points).toBe(10);
    });

    it('awards 0 pts when all flags are false', () => {
      const result = validatePrompt(emptyPrompt());
      expect(result.criteria.find(c => c.name === 'Success Criteria')!.points).toBe(0);
      expect(result.criteria.find(c => c.name === 'Testing Checklist')!.points).toBe(0);
      expect(result.criteria.find(c => c.name === 'Code Examples')!.points).toBe(0);
    });
  });

  // ----- Criterion 8-9: Time and Revenue (5 pts each) -----
  describe('criterion 8-9: Time and Revenue', () => {
    it('awards 5 pts each when present', () => {
      const result = validatePrompt(emptyPrompt({
        estimatedTime: '4 hours',
        revenueImpact: 'High — enables payment flow',
      }));
      expect(result.criteria.find(c => c.name === 'Time Estimate')!.points).toBe(5);
      expect(result.criteria.find(c => c.name === 'Revenue Impact')!.points).toBe(5);
    });

    it('awards 0 pts when missing', () => {
      const result = validatePrompt(emptyPrompt());
      expect(result.criteria.find(c => c.name === 'Time Estimate')!.points).toBe(0);
      expect(result.criteria.find(c => c.name === 'Revenue Impact')!.points).toBe(0);
    });
  });

  // ----- Criterion 10: Checklists (5 pts) -----
  describe('criterion 10: Checklists', () => {
    it('awards 5 pts for >=3 checklist items', () => {
      const result = validatePrompt(emptyPrompt({ checklistItems: 5 }));
      expect(result.criteria.find(c => c.name === 'Checklists')!.points).toBe(5);
    });

    it('awards 3 pts for 1-2 checklist items', () => {
      const result = validatePrompt(emptyPrompt({ checklistItems: 2 }));
      expect(result.criteria.find(c => c.name === 'Checklists')!.points).toBe(3);
    });

    it('awards 0 pts for 0 checklist items', () => {
      const result = validatePrompt(emptyPrompt({ checklistItems: 0 }));
      expect(result.criteria.find(c => c.name === 'Checklists')!.points).toBe(0);
    });
  });

  // ----- Criterion 11: Reference Impl (5 pts) -----
  describe('criterion 11: Reference Implementation', () => {
    it('awards 5 pts when present', () => {
      const result = validatePrompt(emptyPrompt({ hasReferenceImpl: true }));
      expect(result.criteria.find(c => c.name === 'Reference Impl')!.points).toBe(5);
    });

    it('awards 0 pts when missing', () => {
      const result = validatePrompt(emptyPrompt({ hasReferenceImpl: false }));
      expect(result.criteria.find(c => c.name === 'Reference Impl')!.points).toBe(0);
    });
  });

  // ----- Criterion 12: Content Depth (5 pts) -----
  describe('criterion 12: Content Depth', () => {
    it('awards 5 pts for >=100 lines', () => {
      const result = validatePrompt(emptyPrompt({ totalLines: 150 }));
      expect(result.criteria.find(c => c.name === 'Content Depth')!.points).toBe(5);
    });

    it('awards 3 pts for 50-99 lines', () => {
      const result = validatePrompt(emptyPrompt({ totalLines: 75 }));
      expect(result.criteria.find(c => c.name === 'Content Depth')!.points).toBe(3);
    });

    it('awards 1 pt for <50 lines', () => {
      const result = validatePrompt(emptyPrompt({ totalLines: 20 }));
      expect(result.criteria.find(c => c.name === 'Content Depth')!.points).toBe(1);
    });
  });

  // ----- Criteria 13-18: New fields -----
  describe('criteria 13-18: New fields', () => {
    it('awards 5 pts for Files to Modify when present', () => {
      const result = validatePrompt(emptyPrompt({ hasFilesToModify: true }));
      expect(result.criteria.find(c => c.name === 'Files to Modify')!.points).toBe(5);
    });

    it('awards 2 pts for Tags / Labels when section present but no values extracted', () => {
      const result = validatePrompt(emptyPrompt({ hasTags: true }));
      expect(result.criteria.find(c => c.name === 'Tags / Labels')!.points).toBe(2);
    });

    it('awards 3 pts for Tags / Labels when all tags are valid UGWTF labels', () => {
      const result = validatePrompt(emptyPrompt({ hasTags: true, tags: ['type:feat', 'scope:ui'] }));
      expect(result.criteria.find(c => c.name === 'Tags / Labels')!.points).toBe(3);
    });

    it('awards 1 pt for Tags / Labels when some tags are invalid', () => {
      const result = validatePrompt(emptyPrompt({ hasTags: true, tags: ['type:feat', 'scrollytelling'] }));
      const c = result.criteria.find(c => c.name === 'Tags / Labels')!;
      expect(c.points).toBe(1);
      expect(c.note).toContain('scrollytelling');
    });

    it('awards 5 pts for Environment when present', () => {
      const result = validatePrompt(emptyPrompt({ hasEnvironment: true }));
      expect(result.criteria.find(c => c.name === 'Environment')!.points).toBe(5);
    });

    it('awards 5 pts for Blocking Gate when present', () => {
      const result = validatePrompt(emptyPrompt({ hasBlockingGate: true }));
      expect(result.criteria.find(c => c.name === 'Blocking Gate')!.points).toBe(5);
    });

    it('awards 5 pts for Merge Gate when present', () => {
      const result = validatePrompt(emptyPrompt({ hasMergeGate: true }));
      expect(result.criteria.find(c => c.name === 'Merge Gate')!.points).toBe(5);
    });

    it('awards 2 pts for Dependencies when present', () => {
      const result = validatePrompt(emptyPrompt({ depends: ['#1'] }));
      expect(result.criteria.find(c => c.name === 'Dependencies')!.points).toBe(2);
    });

    it('awards 0 pts for all new fields when absent', () => {
      const result = validatePrompt(emptyPrompt());
      expect(result.criteria.find(c => c.name === 'Files to Modify')!.points).toBe(0);
      expect(result.criteria.find(c => c.name === 'Tags / Labels')!.points).toBe(0);
      expect(result.criteria.find(c => c.name === 'Environment')!.points).toBe(0);
      expect(result.criteria.find(c => c.name === 'Blocking Gate')!.points).toBe(0);
      expect(result.criteria.find(c => c.name === 'Merge Gate')!.points).toBe(0);
      expect(result.criteria.find(c => c.name === 'Dependencies')!.points).toBe(0);
    });
  });

  // ----- Aggregate scoring -----
  describe('aggregate scoring', () => {
    it('returns exactly 24 criteria', () => {
      const result = validatePrompt(emptyPrompt());
      expect(result.criteria).toHaveLength(24);
    });

    it('maxScore is always 149', () => {
      const result = validatePrompt(emptyPrompt());
      expect(result.maxScore).toBe(149);
    });

    it('percent is correctly computed from score/maxScore', () => {
      const result = validatePrompt(perfectPrompt());
      expect(result.percent).toBe(Math.round((result.score / result.maxScore) * 100));
    });

    it('mid-range prompt scores between 35-80%', () => {
      const mid = emptyPrompt({
        title: 'Database Schema Setup',
        priority: 'P1',
        objective: 'Create the database schema for the project with all required tables.',
        sections: ['Objective', 'Implementation'],
        hasSuccessCriteria: true,
        totalLines: 60,
      });
      const result = validatePrompt(mid);
      expect(result.percent).toBeGreaterThanOrEqual(35);
      expect(result.percent).toBeLessThanOrEqual(80);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// parseDependencies
// ═══════════════════════════════════════════════════════════════════════════

describe('parseDependencies', () => {
  it('returns empty for "None"', () => {
    expect(parseDependencies('**Dependencies**: None')).toEqual([]);
  });

  it('returns empty for "can run in parallel"', () => {
    expect(parseDependencies('**Dependencies**: None — can run in parallel')).toEqual([]);
  });

  it('parses single gap reference', () => {
    expect(parseDependencies('**Dependencies**: Gaps #2')).toEqual(['#2']);
  });

  it('parses multiple gap references', () => {
    expect(parseDependencies('**Dependencies**: Gaps #1, #2 must be completed first.')).toEqual(['#1', '#2']);
  });

  it('parses FI-XX style IDs', () => {
    expect(parseDependencies('**Depends On**: FI-01, FI-03')).toEqual(['FI-01', 'FI-03']);
  });

  it('parses filename references', () => {
    expect(parseDependencies('**Dependencies**: 01-supabase-client-setup')).toEqual(['01-supabase-client-setup']);
  });

  it('returns empty when no dependency line exists', () => {
    expect(parseDependencies('# Just a title\nSome content')).toEqual([]);
  });

  it('handles "Dependency" singular form', () => {
    expect(parseDependencies('**Dependency**: Gaps #5 must be completed first.')).toEqual(['#5']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// scanAllPrompts — fixture-based integration
// ═══════════════════════════════════════════════════════════════════════════

describe('scanAllPrompts', () => {
  beforeEach(() => {
    clearPromptScanCache();
  });

  it('discovers all fixture prompts', async () => {
    const prompts = await scanAllPrompts(FIXTURES_DIR);
    // 7 Format B + 1 Format A = 8 total
    expect(prompts.length).toBe(8);
  });

  it('identifies Format A prompts from .github/prompts/', async () => {
    const prompts = await scanAllPrompts(FIXTURES_DIR);
    const formatA = prompts.filter(p => p.format === 'A');
    expect(formatA.length).toBeGreaterThanOrEqual(1);
    expect(formatA[0]!.fileName).toBe('setup-linting.prompt.md');
  });

  it('identifies Format B prompts from docs/prompts/', async () => {
    const prompts = await scanAllPrompts(FIXTURES_DIR);
    const formatB = prompts.filter(p => p.format === 'B');
    expect(formatB.length).toBe(7);
  });

  it('parses priority from Format B prompts', async () => {
    const prompts = await scanAllPrompts(FIXTURES_DIR);
    const p0 = prompts.filter(p => p.priority === 'P0');
    expect(p0.length).toBe(2); // 01-setup-foundation, 02-database-schema
  });

  it('parses title from Format B prompts', async () => {
    const prompts = await scanAllPrompts(FIXTURES_DIR);
    const setup = prompts.find(p => p.fileName === '01-setup-foundation.prompt.md');
    expect(setup).toBeDefined();
    expect(setup!.title).toBe('Setup Foundation');
  });

  it('caches results on second call', async () => {
    const first = await scanAllPrompts(FIXTURES_DIR);
    const second = await scanAllPrompts(FIXTURES_DIR);
    expect(first).toBe(second); // same reference = cache hit
  });

  it('returns fresh results after clearPromptScanCache()', async () => {
    const first = await scanAllPrompts(FIXTURES_DIR);
    clearPromptScanCache();
    const second = await scanAllPrompts(FIXTURES_DIR);
    expect(first).not.toBe(second); // different reference
    expect(first.length).toBe(second.length); // same content
  });

  it('returns empty for nonexistent directory', async () => {
    const prompts = await scanAllPrompts('/nonexistent/path');
    expect(prompts).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Prompt Agents — existence and shouldRun
// ═══════════════════════════════════════════════════════════════════════════

describe('promptAgents', () => {
  it('exports 4 agents', () => {
    expect(promptAgents).toHaveLength(4);
  });

  it('has correct agent IDs', () => {
    const ids = promptAgents.map(a => a.id);
    expect(ids).toContain('prompt-scanner');
    expect(ids).toContain('prompt-validator');
    expect(ids).toContain('prompt-issue-creator');
    expect(ids).toContain('prompt-forecaster');
  });

  it('all agents belong to "prompts" cluster', () => {
    for (const agent of promptAgents) {
      expect(agent.clusterId).toBe('prompts');
    }
  });

  it('all agents return shouldRun() = true', () => {
    for (const agent of promptAgents) {
      // shouldRun() takes no meaningful args for these agents
      expect(agent.shouldRun({} as any)).toBe(true);
    }
  });
});

describe('promptFixerAgents', () => {
  it('exports 1 agent', () => {
    expect(promptFixerAgents).toHaveLength(1);
  });

  it('has correct agent ID', () => {
    expect(promptFixerAgents[0]!.id).toBe('prompt-fixer');
  });

  it('belongs to "fix-prompts" cluster', () => {
    expect(promptFixerAgents[0]!.clusterId).toBe('fix-prompts');
  });

  it('shouldRun returns false without fix-prompts command', () => {
    expect(promptFixerAgents[0]!.shouldRun({} as any)).toBe(false);
  });

  it('shouldRun returns true when command is fix-prompts', () => {
    expect(promptFixerAgents[0]!.shouldRun({ extras: { command: 'fix-prompts' } } as any)).toBe(true);
  });

  it('shouldRun returns true when fixPrompts flag is set', () => {
    expect(promptFixerAgents[0]!.shouldRun({ extras: { fixPrompts: 'true' } } as any)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integration: validatePrompt on real fixture prompts
// ═══════════════════════════════════════════════════════════════════════════

describe('validatePrompt on fixtures', () => {
  beforeEach(() => {
    clearPromptScanCache();
  });

  it('scores Format B fixture 01-setup-foundation reasonably', async () => {
    const prompts = await scanAllPrompts(FIXTURES_DIR);
    const p = prompts.find(p => p.fileName === '01-setup-foundation.prompt.md')!;
    const result = validatePrompt(p);

    // Has: title, priority, objective, success criteria, time, agent
    // Missing: testing checklist, code examples, revenue, ref impl, few lines
    expect(result.percent).toBeGreaterThanOrEqual(40);
    expect(result.percent).toBeLessThan(100);
    expect(result.criteria.find(c => c.name === 'Priority')!.points).toBe(10);
    expect(result.criteria.find(c => c.name === 'Success Criteria')!.points).toBe(10);
  });

  it('scores Format A fixture lower than Format B (less structure)', async () => {
    const prompts = await scanAllPrompts(FIXTURES_DIR);
    const formatA = prompts.find(p => p.format === 'A')!;
    const formatB = prompts.find(p => p.format === 'B' && p.priority === 'P0')!;

    const scoreA = validatePrompt(formatA);
    const scoreB = validatePrompt(formatB);

    // Format A lacks priority, time, revenue — should score lower
    expect(scoreA.percent).toBeLessThan(scoreB.percent);
  });
});
