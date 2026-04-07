# Phase 3: Pipeline Integration

**Priority**: p2
**Status**: ⏳ **NOT STARTED**
**Estimated Time**: Low
**Revenue Impact**: Low
**Dependencies**: 02-agent-sync
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

Register the new repositories from the audit (which brings the total to 48) into the `ugwtf` tracking framework via `src/config/repo-registry.ts`.

---

## Pre-Flight Check

```bash
cat ~/management-git/ugwtf/src/config/repo-registry.ts
```

---

## Intended Result

All 48 monitored repositories are properly registered in `ugwtf` to allow the orchestration of issue tracking, PR validation, and deep audits.

---

## Files to Modify/Create

| File | Action | Exists? | Purpose |
|------|--------|---------|---------|
| `src/config/repo-registry.ts` | MODIFY | Yes | Add new repo aliases |

---

## data-testid Contracts

| testid | Action | Used By |
|--------|--------|---------|
| None | N/A | N/A |

---

## Blast Radius

```bash
grep -rn "repoRegistry" src/
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

All 48 new repositories are successfully registered as valid string aliases in the registry.

---

## Testing Checklist

```bash
#!/bin/bash
npx tsc --noEmit || exit 1
npm run build || exit 1
node dist/index.js status
```

---

## Implementation

Extract un-registered paths from `Management/audit-results.json`, convert their names to standard aliases, and append them into `repo-registry.ts`. Update the valid union type to reflect the additions.

---

## Reference Implementation

The existing 6 Big Repos in `src/config/repo-registry.ts`.

---

## Environment

- **Framework**: Node CLI
- **Dependencies**: None
- **FSD Layer**: config

---

## Database / Supabase

No DB changes

---

## Routes Affected

None

---

## Blocking Gate

```bash
cat ~/management-git/Management/audit-results.json | grep 'totalRepos'
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
