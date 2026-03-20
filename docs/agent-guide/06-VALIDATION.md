# UGWTF — 12-Point Gold Standard Scoring

The `validatePrompt()` function in `prompt-agents.ts` scores each `.prompt.md` file against 12 criteria (100 points max).

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

## Pass/Fail Threshold

- **Agent `prompt-validator`** computes the average score across all prompts
- **Average ≥ 80%** → PASS
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
