# UGWTF — 20-Point Gold Standard Scoring

The `validatePrompt()` function in `src/prompt/score.ts` scores each `.prompt.md` file against 20 criteria (133 points max).

> **v2.0 (2026-04-01)**: Added #19 Blast Radius Check and #20 A11y Gates after PR #573 post-mortem revealed prompts that change values without searching for all occurrences.

## Scoring Table

| # | Criterion | Max Pts | Full Score | Partial | Zero |
|---|-----------|---------|------------|---------|------|
| 1 | Title | 10 | 5-119 chars | 1-4 or 120+ chars (5pts) | Empty |
| 2 | Priority | 10 | Format B + priority set | Format A (5pts) | Format B + missing |
| 3 | Objective | 15 | >20 chars | 1-20 chars (8pts) | Missing |
| 4 | Sections | 10 | ≥4 sections | 2-3 (6pts), 1 (3pts) | 0 sections |
| 5 | Success Criteria | 10 | Present | — | Missing |
| 6 | Testing Checklist | 10 | Present | — | Missing |
| 7 | Code Examples | 10 | Has ` ```language ` blocks | — | Missing |
| 8 | Time Estimate | 5 | Present | — | Missing |
| 9 | Revenue Impact | 5 | Present | — | Missing |
| 10 | Checklists | 5 | ≥3 items | 1-2 items (3pts) | 0 items |
| 11 | Reference Impl | 5 | Present | — | Missing |
| 12 | Content Depth | 5 | ≥100 lines | 50-99 lines (3pts) | <50 lines (1pt) |
| 13 | Files to Modify | 5 | `## Files to Modify/Create/Touch` present | — | Missing |
| 14 | Tags / Labels | 3 | `**Tags**` or `**Labels**` present | — | Missing |
| 15 | Environment | 5 | `## Environment` present | — | Missing |
| 16 | Blocking Gate | 5 | `## Blocking Gate` present | — | Missing |
| 17 | Merge Gate | 5 | `## Merge Gate` present | — | Missing |
| 18 | Dependencies | 2 | `depends` has ≥1 ref | — | Empty |
| 19 | Blast Radius Check | 5 | `## Blast Radius` section with grep commands for old values | — | Missing |
| 20 | A11y Gates | 3 | `aria-label`, `role`, `heading hierarchy` in success criteria or checklist | Partial (1pt) | Missing |

> **Why #19–#20 exist**: PR #573 changed shipping prices in 7 backend files but missed 20 customer-facing files displaying the same `$5.99` value. A single `grep -r '$5.99' src/` would have caught it. A11y was also never in scope, leaving the shipping page without semantic HTML. These criteria prevent the same class of miss.

## Pass/Fail Threshold

- **Agent `prompt-validator`** computes the average score across all prompts
- **Average ≥ 80%** → PASS (133 max pts, threshold = 107)
- **Average < 80%** → FAIL (agent returns `status: 'fail'`)

## Prompt Formats

### Format B (Primary — `docs/prompts/`, `docs/agent-prompts/`)

```markdown
# PROMPT: Title Here

**Priority**: P0
**Status**: READY TO START
**Estimated Time**: 4 hours
**Agent Type**: Database Agent
**Revenue Impact**: High — enables checkout
**Dependencies**: Gaps #1, #2

## Objective
Clear description of what to build...

## Success Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Testing Checklist
- [ ] Test 1

## Implementation
` ` `typescript
// code example
` ` `

## Blast Radius
Before implementing, search for ALL occurrences of values being changed:
` ` `bash
grep -r '$5.99' src/       # Find all hardcoded price refs
grep -r 'OLD_CONSTANT' .   # Find all usages of constants being updated
` ` `
Update every occurrence or document why specific files are excluded.

## A11y Checklist
- [ ] All interactive elements have `aria-label`
- [ ] Heading hierarchy is sequential (no h1 → h3 skip)
- [ ] Form inputs have associated labels
- [ ] Color contrast meets WCAG AA (4.5:1 text, 3:1 large)

## Reference Implementation
See existing implementation...
```

### Format A (Simple — `.github/prompts/`)

```markdown
---
description: Short description
agent: agent-name
---

# Title

## Steps
1. Step one
2. Step two
```

Format A gets partial credit on Priority (5/10) since it lacks a priority system.

## Using in Scripts

```typescript
import { validatePrompt, scanAllPrompts } from './agents/prompt-agents.js';

const prompts = await scanAllPrompts('/path/to/repo');
for (const p of prompts) {
  const result = validatePrompt(p);
  console.log(`${p.fileName}: ${result.percent}% (${result.score}/${result.maxScore})`);
  for (const c of result.criteria) {
    console.log(`  ${c.name}: ${c.points}/${c.maxPoints}`);
  }
}
```

## Readiness Forecasting

The `prompt-forecaster` agent computes a **30x readiness score**:

```
readiness = quality × 0.4 + completion × 0.3 + backlog × 0.3
```

Where:
- **quality** = average validation score across all prompts
- **completion** = % of prompts with status "COMPLETED"
- **backlog** = inverse of outstanding P0/P1 issues
