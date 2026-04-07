# Phase 1: Core Instruction Propagation

**Priority**: p1
**Status**: ⏳ **NOT STARTED**
**Estimated Time**: Medium
**Revenue Impact**: Low
**Dependencies**: None
**Tags**: type:chore, scope:ci, automation:copilot, agent:copilot, prompt-spec, enhancement

---

## Agent Bootstrap

> ⚠️ The agent executing this prompt MUST load these files first:

```bash
# 1. Repo instructions (mandatory)
cat .github/copilot-instructions.md
cat AGENTS.md

# 2. Path-specific instructions (load all matching)
ls .github/instructions/*.instructions.md

# 3. Active sprint context
cat docs/active/INDEX.md
```

**Instruction files to load** (based on task scope):
- `commit-quality.instructions.md` — always
- `core-directives.instructions.md` — always
- `typescript.instructions.md` — any code change
- `regression-prevention.instructions.md` — any UI change
- `ugwtf-workflow.instructions.md`

---

## Objective

Inject fundamental instruction files (`copilot-instructions.md`, `commit-quality.instructions.md`, `core-directives.instructions.md`, `typescript.instructions.md`) into all monitored repositories that are currently missing them.

---

## Pre-Flight Check

```bash
find ~/management-git -maxdepth 2 -type d -name ".github"
```

---

## Intended Result

100% of the 48 monitored repositories contain the gold standard core instruction files.

---

## Files to Modify/Create

| File | Action | Exists? | Purpose |
|------|--------|---------|---------|
| `*/.github/copilot-instructions.md` | CREATE/UPDATE | Mixed | Base instructions |
| `*/.github/instructions/commit-quality.instructions.md` | CREATE/UPDATE | Mixed | Pre-commit gates |
| `*/.github/instructions/core-directives.instructions.md` | CREATE/UPDATE | Mixed | Standards |

---

## data-testid Contracts

| testid | Action | Used By |
|--------|--------|---------|
| None | N/A | N/A |

---

## Blast Radius

```bash
find ~/management-git -name "copilot-instructions.md" | wc -l
```

---

## A11y Checklist

- [ ] Interactive elements have `aria-label`
- [ ] Heading hierarchy preserved (no h1→h3 skip)
- [ ] Color contrast: brand tokens pass WCAG AA


---

## Design System

- [ ] No hardcoded hex/rgb — Tailwind tokens only
- [ ] No hardcoded px — Tailwind spacing scale
- [ ] Dark mode: semantic tokens (bg-surface, etc.)


---

## Success Criteria

All 48 repositories possess the mandatory core instruction files. No repositories fail the basic instructional configuration audit.

---

## Testing Checklist

```bash
#!/bin/bash
npx tsc --noEmit || exit 1
npm run lint || exit 1
npm run build || exit 1

```

---

## Implementation

Create a script to copy the gold standard instruction files from `documentation-standards/workspace-rules` or `management-git/.github` to all target repositories.

---

## Reference Implementation

`documentation-standards` sync scripts.

---

## Environment

- **Framework**: Node CLI
- **Dependencies**: fs, path
- **FSD Layer**: shared

---

## Database / Supabase

No DB changes

---

## Routes Affected

None

---

## Blocking Gate

```bash
ls ~/management-git/documentation-standards/workspace-rules
```

---

## Merge Gate

```bash
npx tsc --noEmit
npm run lint
npm run build
```

---

## Workflow & Lifecycle

**CI Validation**: `ci.yml` — tsc + lint + build + test
**PR Promotion**: `copilot-pr-promote.yml` — labels, milestone, reviewer
**PR Validation**: `copilot-pr-validate.yml` — quality gates + blast radius
**Chain Advance**: `copilot-chain-advance.yml` — closes → next issue

**Post-Merge Steps** (automated):
1. PR merged → `copilot-pr-merged.yml` adds `automation:completed`
2. Linked chain issue auto-closes
3. `copilot-chain-advance.yml` activates next wave
4. Branch auto-deleted

**E2E Tests to Run**:
- `e2e/specs/route-health.spec.ts` — smoke

