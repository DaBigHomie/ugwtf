/**
 * Prompt scoring — 18-point validation with weighted criteria.
 *
 * 12 original criteria (100 pts) + 6 new criteria (25 pts) = 125 max.
 * Score is normalized to a 0-100 percentage.
 *
 * Criteria #1-#12  — original set (unchanged names & weights for backward compat)
 * Criteria #13-#18 — new descriptors added by the 18-pt split
 */
import type { ParsedPrompt, CriterionResult, ValidationResult } from './types.js';

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
// 18-point validator
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

  // #14 — Tags / Labels (3 pts)
  criteria.push({ name: 'Tags / Labels', points: p.hasTags ? 3 : 0, maxPoints: 3, note: p.hasTags ? 'Present' : 'No tags or labels' });

  // #15 — Environment (5 pts)
  criteria.push({ name: 'Environment', points: p.hasEnvironment ? 5 : 0, maxPoints: 5, note: p.hasEnvironment ? 'Present' : 'No environment or secrets declared' });

  // #16 — Blocking Gate (5 pts)
  criteria.push({ name: 'Blocking Gate', points: p.hasBlockingGate ? 5 : 0, maxPoints: 5, note: p.hasBlockingGate ? 'Present' : 'No blocking prerequisites' });

  // #17 — Merge Gate (5 pts)
  criteria.push({ name: 'Merge Gate', points: p.hasMergeGate ? 5 : 0, maxPoints: 5, note: p.hasMergeGate ? 'Present' : 'No merge requirements' });

  // #18 — Dependencies (2 pts)
  criteria.push({ name: 'Dependencies', points: p.depends.length > 0 ? 2 : 0, maxPoints: 2, note: p.depends.length > 0 ? p.depends.join(', ') : 'No explicit dependencies' });

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
