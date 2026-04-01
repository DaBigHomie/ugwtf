# UGWTF — 24-Point Gold Standard Scoring

> `validatePrompt()` in `src/prompt/score.ts` · v3.0 (2026-04-01)
> · 24 criteria · 149 pts max

---

## Scoring Table

| # | Criterion | Max | Full | Partial | Zero |
|---|-----------|-----|------|---------|------|
| 1 | Title | 10 | 6-119 chars | 1-5 or 120+ (5pts) | Empty |
| 2 | Priority | 10 | P0-P3 set | Format A (5pts) | Missing |
| 3 | Objective | 15 | >20 chars | 1-20 chars (8pts) | Missing |
| 4 | Sections | 10 | ≥4 sections | 2-3 (6), 1 (3) | 0 sections |
| 5 | Success Criteria | 10 | Intended result | — | Missing |
| 6 | Testing Checklist | 10 | Commands present | — | Missing |
| 7 | Code Examples | 10 | Fenced blocks | — | Missing |
| 8 | Time Estimate | 5 | Present | — | Missing |
| 9 | Revenue Impact | 5 | Present | — | Missing |
| 10 | Checklists | 5 | ≥3 items | 1-2 items (3pts) | 0 items |
| 11 | Reference Impl | 5 | Present | — | Missing |
| 12 | Content Depth | 5 | ≥100 lines | 50-99 (3pts) | <50 (1pt) |
| 13 | Files to Modify | 5 | Section present | — | Missing |
| 14 | Tags / Labels | 3 | All valid | Some invalid (1pt) | Missing |
| 15 | Environment | 5 | Section present | — | Missing |
| 16 | Blocking Gate | 5 | Section present | — | Missing |
| 17 | Merge Gate | 5 | Section present | — | Missing |
| 18 | Dependencies | 2 | ≥1 machine ref | — | Empty |
| 19 | Blast Radius | 5 | `## Blast Radius` + grep | — | Missing |
| 20 | A11y Gates | 3 | a11y keywords | Partial (1pt) | Missing |
| 21 | Design System | 5 | `## Design System` | — | Missing |
| 22 | data-testid | 3 | `## data-testid` table | — | Missing |
| 23 | Agent Bootstrap | 5 | `## Agent Bootstrap` | — | Missing |
| 24 | Workflow Lifecycle | 3 | CI/chain refs | — | Missing |

**Total: 149 points**

---

## Critical Distinctions

### #5 Success Criteria ≠ #6 Testing Checklist

| Section | Contains | Example |
|---------|----------|---------|
| Success Criteria | **What exists** after completion | "Users see clip-reveal animation" |
| Testing Checklist | **Commands** agent runs to verify | `npx tsc --noEmit \|\| exit 1` |

⛔ Success Criteria that are just command checklists score 0.

---

## Tag Validation (#14)

Tags must come from UGWTF `UNIVERSAL_LABELS`. The scorer validates
each tag against the known label set.

### ✅ Valid Tags

| Category | Labels |
|----------|--------|
| Type | `type:feat` `type:fix` `type:chore` `type:docs` |
| Type | `type:refactor` `type:test` `type:ci` |
| Scope | `scope:ui` `scope:ci` `scope:db` `scope:api` `scope:auth` |
| Category | `database` `infrastructure` `enhancement` `bug` |
| Category | `documentation` `dependencies` `security` |
| Migration | `safe-migration` `destructive-migration` `types-update` |
| 043-only | `ecommerce` `checkout` `pdp` `admin` `orders` |
| 043-only | `conversion` `marketing` `social` |

### ⛔ Invalid Tags (Freeform — Score 0 or 1)

| Example | Why Invalid |
|---------|-------------|
| `scrollytelling` | Not in UGWTF label set |
| `animation` | Not in UGWTF label set |
| `gsap` | Not in UGWTF label set |
| `hero-section` | Not in UGWTF label set |

### Scoring Logic

| Score | Condition |
|-------|-----------|
| 3 pts | All tags are valid UGWTF labels |
| 2 pts | Tags / labels section exists but no tags can be extracted (e.g., malformed or empty) |
| 1 pt | At least one valid tag, but some tags are invalid / not in the UGWTF label set |
| 0 pts | No tags / labels field found |

---

## New Criteria (#19–#22) — Why They Exist

| # | Criterion | Origin |
|---|-----------|--------|
| 19 | Blast Radius | PR #573: changed `$5.99` in 7 files, missed 20 |
| 20 | A11y Gates | Shipping page had no semantic HTML |
| 21 | Design System | Hardcoded hex colors survived 3 audit cycles |
| 22 | data-testid | Chain-5: testid renames broke 14 E2E specs |

---

## Removed Fields

| Field | Reason |
|-------|--------|
| `**Agent Type**` | All prompts target Copilot — no phantom agents |
| `## Commands` | 0/147 prompts used it; Testing Checklist covers this |

---

## Validation Command

```bash
npx tsx scripts/validate-prompts.mts \
  --cwd <repo-path> --verbose
```

---

## Threshold Recommendations

| Level | Score | Percent | Action |
|-------|-------|---------|--------|
| ✅ Gold | ≥134 | ≥90% | Ready for chain deployment |
| ⚠️ Pass | ≥119 | ≥80% | Deployable with warnings |
| ⛔ Fail | <119 | <80% | Block — fix before deploy |

The `prompt-validator` agent computes average score across all
prompts. Average ≥80% (≥119/149) required to pass.

---

## Prompt Formats

### Format B (Primary — `docs/prompts/`, `docs/agent-prompts/`)

Full template with all 24 criteria. See
`prompt-instructions.md` for the complete template.

### Format A (Simple — `.github/prompts/`)

```markdown
---
description: Short description
---

# Title

## Steps
1. Step one
```

Format A gets partial credit on Priority (5/10) only.

---

## Using in Scripts

```typescript
import {
  validatePrompt, scanAllPrompts
} from './agents/prompt-agents.js';

const prompts = await scanAllPrompts('/path/to/repo');
for (const p of prompts) {
  const r = validatePrompt(p);
  console.log(`${p.fileName}: ${r.percent}%`);
  console.log(`  (${r.score}/${r.maxScore})`);
  for (const c of r.criteria) {
    if (c.points < c.maxPoints) {
      console.log(`  ⚠️ ${c.name}: ${c.points}/${c.maxPoints}`);
    }
  }
}
```

---

## Readiness Forecasting

```
readiness = quality × 0.4 + completion × 0.3 + backlog × 0.3
```

| Factor | Source |
|--------|--------|
| quality | Average validation score (all prompts) |
| completion | % of prompts with status COMPLETED |
| backlog | Inverse of outstanding P0/P1 issues |

---

## #23 Agent Bootstrap

Detects `## Agent Bootstrap` section or mentions of
`copilot-instructions.md` / `AGENTS.md`.

| Score | Condition |
|-------|-----------|
| 5 pts | Section present with instruction file list |
| 0 pts | Missing — agent may execute blind |

**What to include**:
- `cat .github/copilot-instructions.md` — mandatory
- `cat AGENTS.md` — mandatory
- Path-specific instruction files for the task scope
- `docs/active/INDEX.md` for sprint context

---

## #24 Workflow & Lifecycle

Detects `## Workflow & Lifecycle` or references to specific
workflow files (`copilot-chain-advance`, `copilot-pr-validate`,
`Post-Merge Steps`).

| Score | Condition |
|-------|-----------|
| 3 pts | Workflow references present |
| 0 pts | Missing — agent doesn't know post-merge lifecycle |

**What to include**:
- CI workflow (`ci.yml`) that validates the PR
- PR promotion/validation workflows
- Chain advance workflow
- Post-merge label transitions
- E2E test specs to run
