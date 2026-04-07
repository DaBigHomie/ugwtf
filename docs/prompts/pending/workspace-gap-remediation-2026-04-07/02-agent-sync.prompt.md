# Phase 2: Agent Catalog & Sync

**Priority**: p2
**Status**: ⏳ **NOT STARTED**
**Estimated Time**: Medium
**Revenue Impact**: Low
**Dependencies**: 01-core-propagation
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
- `ugwtf-workflow.instructions.md`

---

## Objective

Create a global catalog of the 95 agents identified across the workspace and distribute universally applicable `.agent.md` files where missing.

---

## Pre-Flight Check

```bash
find ~/management-git -name "*.agent.md"
```

---

## Intended Result

A consolidated `WORKSPACE_AGENTS.md` cataloging all available agents, with universal agents accessible in every project via `.github/agents/`.

---

## Files to Modify/Create

| File | Action | Exists? | Purpose |
|------|--------|---------|---------|
| `WORKSPACE_AGENTS.md` | CREATE | No | Global catalog |
| `*/.github/agents/*` | CREATE/UPDATE | Mixed | Sync universal agents |

---

## data-testid Contracts

| testid | Action | Used By |
|--------|--------|---------|
| None | N/A | N/A |

---

## Blast Radius

```bash
find ~/management-git -name "*.agent.md" | wc -l
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

All 95 agents are mapped and universally relevant agents exist globally, resulting in standardized AI-agent toolsets across all evaluated repos.

---

## Testing Checklist

```bash
#!/bin/bash
npx tsc --noEmit || exit 1
npm run lint || exit 1
```

---

## Implementation

Extract agent list from `Management/audit-results.json` and generate the markdown documentation, followed by a distribution script.

---

## Reference Implementation

`node dist/index.js audit` from UGWTF.

---

## Environment

- **Framework**: Node CLI
- **Dependencies**: fs
- **FSD Layer**: scripts

---

## Database / Supabase

No DB changes

---

## Routes Affected

None

---

## Blocking Gate

```bash
cat ~/management-git/Management/audit-results.json
```

---

## Merge Gate

```bash
npx tsc --noEmit
npm run lint
```

---

## Workflow & Lifecycle

**CI Validation**: `ci.yml` — tsc + lint + build + test
**PR Promotion**: `copilot-pr-promote.yml` — labels, milestone, reviewer
**PR Validation**: `copilot-pr-validate.yml` — quality gates + blast radius
**Chain Advance**: `copilot-chain-advance.yml` — closes → next issue
