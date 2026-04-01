/**
 * Prompt scoring — 24-point validation with weighted criteria.
 *
 * v1.0: 12 original criteria (100 pts) + 6 new criteria (25 pts) = 125 max
 * v2.0: + 4 criteria (16 pts) = 141 max — blast radius, a11y, design system, data-testid
 * v3.0: + 2 criteria (8 pts) = 149 max — agent bootstrap, workflow lifecycle
 *
 * Score is normalized to a 0-100 percentage.
 *
 * Criteria #1-#12  — original set (unchanged names & weights for backward compat)
 * Criteria #13-#18 — descriptors added by the 18-pt split
 * Criteria #19-#22 — added after PR #573 post-mortem + system audit
 * Criteria #23-#24 — agent bootstrap + workflow lifecycle references
 */
import type { ParsedPrompt, CriterionResult, ValidationResult } from './types.js';
import { UNIVERSAL_LABELS } from '../config/repo-registry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse an estimated-time string into days of effort.
 * Handles ranges ("1-2 days", "2-4 hours"), combined ("2 days 4 hours"),
 * and single values ("1 week", "3 days", "4 hours").
 */
export function parseEstimatedTime(timeStr: string): number {
  let days = 0;

  const rangeDay = timeStr.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*(?:days?|d\b)/i);
  const rangeHour = timeStr.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*(?:hours?|h\b|hrs?\b)/i);

  if (rangeDay) {
    days += parseFloat(rangeDay[2]!);
  } else if (rangeHour) {
    days += parseFloat(rangeHour[2]!) / 8;
  } else {
    for (const m of timeStr.matchAll(/(\d+\.?\d*)\s*(?:weeks?|w\b|wks?\b)/gi)) {
      days += parseFloat(m[1]!) * 5;
    }
    for (const m of timeStr.matchAll(/(\d+\.?\d*)\s*(?:days?|d\b)/gi)) {
      days += parseFloat(m[1]!);
    }
    for (const m of timeStr.matchAll(/(\d+\.?\d*)\s*(?:hours?|h\b|hrs?\b)/gi)) {
      days += parseFloat(m[1]!) / 8;
    }
  }

  return days;
}

// ---------------------------------------------------------------------------
// Valid tags (derived from UGWTF universal labels)
// ---------------------------------------------------------------------------

const VALID_TAGS = new Set(UNIVERSAL_LABELS.map(l => l.name));

// ---------------------------------------------------------------------------
// 24-point validator
// ---------------------------------------------------------------------------

export function validatePrompt(p: ParsedPrompt): ValidationResult {
  const criteria: CriterionResult[] = [];

  // ─── Original 12 criteria (100 pts) ─── names & weights preserved exactly ───

  // #1 — Title (10 pts)
  const titleScore = p.title.length > 5 && p.title.length < 120 ? 10 : (p.title.length > 0 ? 5 : 0);
  criteria.push({ name: 'Title', points: titleScore, maxPoints: 10, note: titleScore === 10 ? 'Clear, descriptive' : 'Too short or too long' });

  // #2 — Priority (10 pts) — Format A gets partial credit
  const priorityScore = p.priority ? 10 : (p.format === 'A' ? 5 : 0);
  criteria.push({ name: 'Priority', points: priorityScore, maxPoints: 10, note: p.priority ? `${p.priority}` : (p.format === 'A' ? 'Format A — no priority system' : 'Missing priority') });

  // #3 — Objective (15 pts)
  const objScore = p.objective && p.objective.length > 20 ? 15 : (p.objective ? 8 : 0);
  criteria.push({ name: 'Objective', points: objScore, maxPoints: 15, note: objScore === 15 ? 'Detailed objective' : (p.objective ? 'Objective too brief' : 'Missing objective') });

  // #4 — Sections (10 pts)
  const sectionScore = p.sections.length >= 4 ? 10 : (p.sections.length >= 2 ? 6 : (p.sections.length >= 1 ? 3 : 0));
  criteria.push({ name: 'Sections', points: sectionScore, maxPoints: 10, note: `${p.sections.length} sections` });

  // #5 — Success Criteria (10 pts)
  const successScore = p.hasSuccessCriteria ? 10 : 0;
  criteria.push({ name: 'Success Criteria', points: successScore, maxPoints: 10, note: successScore ? 'Present' : 'Missing' });

  // #6 — Testing Checklist (10 pts)
  const testScore = p.hasTestingChecklist ? 10 : 0;
  criteria.push({ name: 'Testing Checklist', points: testScore, maxPoints: 10, note: testScore ? 'Present' : 'Missing' });

  // #7 — Code Examples (10 pts)
  const codeScore = p.hasCodeExamples ? 10 : 0;
  criteria.push({ name: 'Code Examples', points: codeScore, maxPoints: 10, note: codeScore ? 'Present' : 'Missing' });

  // #8 — Time Estimate (5 pts)
  const timeScore = p.estimatedTime ? 5 : 0;
  criteria.push({ name: 'Time Estimate', points: timeScore, maxPoints: 5, note: p.estimatedTime ?? 'Missing' });

  // #9 — Revenue Impact (5 pts)
  const revenueScore = p.revenueImpact ? 5 : 0;
  criteria.push({ name: 'Revenue Impact', points: revenueScore, maxPoints: 5, note: p.revenueImpact ?? 'Missing' });

  // #10 — Checklists (5 pts)
  const checkScore = p.checklistItems >= 3 ? 5 : (p.checklistItems >= 1 ? 3 : 0);
  criteria.push({ name: 'Checklists', points: checkScore, maxPoints: 5, note: `${p.checklistItems} items` });

  // #11 — Reference Impl (5 pts)
  const refScore = p.hasReferenceImpl ? 5 : 0;
  criteria.push({ name: 'Reference Impl', points: refScore, maxPoints: 5, note: refScore ? 'Present' : 'Missing' });

  // #12 — Content Depth (5 pts)
  const depthScore = p.totalLines >= 100 ? 5 : (p.totalLines >= 50 ? 3 : 1);
  criteria.push({ name: 'Content Depth', points: depthScore, maxPoints: 5, note: `${p.totalLines} lines` });

  // ─── New 6 criteria (25 pts) ─── added by 18-pt split ───

  // #13 — Files to Modify (5 pts)
  criteria.push({ name: 'Files to Modify', points: p.hasFilesToModify ? 5 : 0, maxPoints: 5, note: p.hasFilesToModify ? 'Present' : 'No file change manifest' });

  // #14 — Tags / Labels (3 pts) — validates against UGWTF label registry
  {
    let tagScore = 0;
    let tagNote = 'No tags or labels';
    if (p.hasTags) {
      if (p.tags.length > 0) {
        const invalid = p.tags.filter(t => !VALID_TAGS.has(t));
        if (invalid.length === 0) {
          tagScore = 3;
          tagNote = `All ${p.tags.length} tags valid`;
        } else {
          tagScore = 1; // partial credit — has tags but some are invalid
          tagNote = `Invalid tags: ${invalid.join(', ')}`;
        }
      } else {
        tagScore = 2; // section exists but couldn't extract values
        tagNote = 'Tags section present but could not extract values';
      }
    }
    criteria.push({ name: 'Tags / Labels', points: tagScore, maxPoints: 3, note: tagNote });
  }

  // #15 — Environment (5 pts)
  criteria.push({ name: 'Environment', points: p.hasEnvironment ? 5 : 0, maxPoints: 5, note: p.hasEnvironment ? 'Present' : 'No environment or secrets declared' });

  // #16 — Blocking Gate (5 pts)
  criteria.push({ name: 'Blocking Gate', points: p.hasBlockingGate ? 5 : 0, maxPoints: 5, note: p.hasBlockingGate ? 'Present' : 'No blocking prerequisites' });

  // #17 — Merge Gate (5 pts)
  criteria.push({ name: 'Merge Gate', points: p.hasMergeGate ? 5 : 0, maxPoints: 5, note: p.hasMergeGate ? 'Present' : 'No merge requirements' });

  // #18 — Dependencies (2 pts)
  criteria.push({ name: 'Dependencies', points: p.depends.length > 0 ? 2 : 0, maxPoints: 2, note: p.depends.length > 0 ? p.depends.join(', ') : 'No explicit dependencies' });

  // ─── v2.0 criteria (16 pts) ─── added after PR #573 post-mortem + system audit ───

  // #19 — Blast Radius (5 pts) — grep commands to find all occurrences of changed values
  criteria.push({ name: 'Blast Radius', points: p.hasBlastRadius ? 5 : 0, maxPoints: 5, note: p.hasBlastRadius ? 'Present' : 'No blast radius check — changed values may exist in other files' });

  // #20 — A11y Gates (3 pts) — aria-label, heading hierarchy, WCAG contrast
  criteria.push({ name: 'A11y Gates', points: p.hasA11y ? 3 : 0, maxPoints: 3, note: p.hasA11y ? 'Present' : 'No accessibility requirements' });

  // #21 — Design System (5 pts) — no hardcoded colors/spacing, use tokens
  criteria.push({ name: 'Design System', points: p.hasDesignSystem ? 5 : 0, maxPoints: 5, note: p.hasDesignSystem ? 'Present' : 'No design system compliance check' });

  // #22 — data-testid Contracts (3 pts) — preserve/create testid values for E2E
  criteria.push({ name: 'data-testid Contracts', points: p.hasTestIdContracts ? 3 : 0, maxPoints: 3, note: p.hasTestIdContracts ? 'Present' : 'No data-testid contract declared' });

  // ─── v3.0 criteria (8 pts) ─── agent bootstrap + workflow lifecycle ───

  // #23 — Agent Bootstrap (5 pts) — instructs executing agent to load instructions/hooks
  criteria.push({ name: 'Agent Bootstrap', points: p.hasAgentBootstrap ? 5 : 0, maxPoints: 5, note: p.hasAgentBootstrap ? 'Present' : 'No agent bootstrap — agent may miss repo instructions' });

  // #24 — Workflow & Lifecycle (3 pts) — references CI, PR, chain-advance workflows
  criteria.push({ name: 'Workflow Lifecycle', points: p.hasWorkflowLifecycle ? 3 : 0, maxPoints: 3, note: p.hasWorkflowLifecycle ? 'Present' : 'No workflow/lifecycle references' });

  const score = criteria.reduce((sum, c) => sum + c.points, 0);
  const maxScore = criteria.reduce((sum, c) => sum + c.maxPoints, 0);

  return {
    prompt: p,
    score,
    maxScore,
    percent: Math.round((score / maxScore) * 100),
    criteria,
  };
}
