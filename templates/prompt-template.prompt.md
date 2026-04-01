# {{TITLE}}

**Priority**: {{PRIORITY}}
**Status**: ⏳ **NOT STARTED**
**Estimated Time**: {{ESTIMATED_TIME}}
**Revenue Impact**: {{REVENUE_IMPACT}}
**Dependencies**: {{DEPENDENCIES}}
**Tags**: {{TAGS}}

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
- {{SCOPE_INSTRUCTIONS}}

---

## Objective

{{OBJECTIVE}}

---

## Pre-Flight Check

```bash
{{PRE_FLIGHT_COMMANDS}}
```

---

## Intended Result

{{INTENDED_RESULT}}

---

## Files to Modify/Create

| File | Action | Exists? | Purpose |
|------|--------|---------|---------|
{{FILES_TABLE_ROWS}}

---

## data-testid Contracts

| testid | Action | Used By |
|--------|--------|---------|
{{TESTID_TABLE_ROWS}}

---

## Blast Radius

```bash
{{BLAST_RADIUS_COMMANDS}}
```

---

## A11y Checklist

- [ ] Interactive elements have `aria-label`
- [ ] Heading hierarchy preserved (no h1→h3 skip)
- [ ] Color contrast: brand tokens pass WCAG AA
{{EXTRA_A11Y_ITEMS}}

---

## Design System

- [ ] No hardcoded hex/rgb — Tailwind tokens only
- [ ] No hardcoded px — Tailwind spacing scale
- [ ] Dark mode: semantic tokens (bg-surface, etc.)
{{EXTRA_DESIGN_ITEMS}}

---

## Success Criteria

{{SUCCESS_CRITERIA}}

---

## Testing Checklist

```bash
#!/bin/bash
npx tsc --noEmit || exit 1
npm run lint || exit 1
npm run build || exit 1
{{EXTRA_TEST_COMMANDS}}
```

---

## Implementation

{{IMPLEMENTATION}}

---

## Reference Implementation

{{REFERENCE_IMPL}}

---

## Environment

- **Framework**: {{FRAMEWORK}}
- **Dependencies**: {{PACKAGES}}
- **FSD Layer**: {{FSD_LAYER}}

---

## Database / Supabase

{{DATABASE_SECTION}}

---

## Routes Affected

{{ROUTES_AFFECTED}}

---

## Blocking Gate

```bash
{{BLOCKING_GATE_COMMANDS}}
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
- {{E2E_SPEC_FILES}}
