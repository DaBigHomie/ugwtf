---
applyTo: "**/prompts/**,**/*.prompt.md,**/agent-prompts/**"
---

# Prompt Authoring — 24-Point Gold Standard

> Scorer v3.0 · 24 criteria · 149 pts max · All prompts target
> Copilot Coding Agent

---

## Template

```markdown
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
- `{{SCOPE_INSTRUCTIONS}}` — task-specific

---

## Objective

[Agent-readable paragraph. WHAT to build + WHY.
Describe BEHAVIOR, not implementation details.
NO specific prop names, import paths, or HTML tags
that may conflict. Let Pre-Flight Check discover
current state.]

---

## Pre-Flight Check

```bash
grep -rn "PATTERN" src/ 2>/dev/null
find src/ -name "RelatedComponent*" 2>/dev/null
```

---

## Intended Result

[Describe what EXISTS after completion. NOT a checkbox
list — a description of the functional outcome.]

---

## Files to Modify/Create

| File | Action | Exists? | Purpose |
|------|--------|---------|---------|
| `{{FILE_PATH}}` | {{ACTION}} | {{EXISTS}} | {{PURPOSE}} |

---

## data-testid Contracts

| testid | Action | Used By |
|--------|--------|---------|
| `{{TESTID}}` | {{TESTID_ACTION}} | {{TESTID_CONSUMER}} |

---

## Blast Radius

```bash
grep -rn "{{CHANGED_PATTERN}}" src/ --include="*.tsx"
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

[Describe the intended functional result — NOT commands.
Example: "Users see a clip-reveal animation on headings.
Animation respects prefers-reduced-motion."]

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

### Step 1: [Action]

```typescript
// Example code
```

---

## Reference Implementation

See `{{REFERENCE_FILE}}` for the pattern to follow.

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
- `{{E2E_SPEC_FILES}}` — feature-specific
```

---

## 24-Criterion Scoring (149 pts max)

| # | Criterion | Pts | What It Checks |
|---|-----------|-----|----------------|
| 1 | Title | 10 | 6-119 chars, descriptive |
| 2 | Priority | 10 | P0-P3 (Format A = 5 partial) |
| 3 | Objective | 15 | >20 chars description |
| 4 | Sections | 10 | ≥4 `## Heading` sections |
| 5 | Success Criteria | 10 | Intended result (⛔ NOT commands) |
| 6 | Testing Checklist | 10 | Commands/scripts agent runs |
| 7 | Code Examples | 10 | Fenced ` ``` ` blocks |
| 8 | Time Estimate | 5 | `**Estimated Time**` present |
| 9 | Revenue Impact | 5 | `**Revenue Impact**` present |
| 10 | Checklists | 5 | ≥3 `- [ ]` items |
| 11 | Reference Impl | 5 | "Reference Implementation" present |
| 12 | Content Depth | 5 | ≥100 lines |
| 13 | Files to Modify | 5 | `## Files to Modify/Create/Touch` |
| 14 | Tags / Labels | 3 | UGWTF labels only (see below) |
| 15 | Environment | 5 | `## Environment` section |
| 16 | Blocking Gate | 5 | `## Blocking Gate` section |
| 17 | Merge Gate | 5 | `## Merge Gate` section |
| 18 | Dependencies | 2 | `#N`, `FI-NN`, or `01-filename` |
| 19 | Blast Radius | 5 | `## Blast Radius` + grep commands |
| 20 | A11y Gates | 3 | `## A11y` or a11y keywords |
| 21 | Design System | 5 | `## Design System` — no hardcoded |
| 22 | data-testid | 3 | `## data-testid` contracts |
| 23 | Agent Bootstrap | 5 | `## Agent Bootstrap` — load instructions |
| 24 | Workflow Lifecycle | 3 | `## Workflow & Lifecycle` — CI/chain refs |

---

## Tag Validation (#14)

Tags MUST come from UGWTF `UNIVERSAL_LABELS`:

| Category | Valid Tags |
|----------|-----------|
| Type | `type:feat` `type:fix` `type:chore` `type:docs` |
| Type | `type:refactor` `type:test` `type:ci` |
| Scope | `scope:ui` `scope:ci` `scope:db` `scope:api` `scope:auth` |
| Category | `database` `infrastructure` `enhancement` `bug` |
| Category | `documentation` `dependencies` `security` |
| Migration | `safe-migration` `destructive-migration` `types-update` |
| 043-only | `ecommerce` `checkout` `pdp` `admin` `orders` |
| 043-only | `conversion` `marketing` `social` |

| Score | Condition |
|-------|-----------|
| 3 pts | All tags valid UGWTF labels |
| 2 pts | Tags section present but values can't be extracted (malformed / unparsable) |
| 1 pt  | Some tags invalid |
| 0 pts | No tags present |

⛔ `scrollytelling`, `animation`, `gsap` → INVALID (freeform)

---

## Validation Command

```bash
npx tsx scripts/validate-prompts.mts \
  --cwd <repo-path> --verbose
```

---

## Metadata Formats (Both Supported)

### Inline (Preferred)

```markdown
**Priority**: P0
**Estimated Time**: 30 minutes
**Revenue Impact**: High
**Tags**: `type:feat`, `scope:ui`
```

### Table

```markdown
| Field | Value |
|-------|-------|
| Priority | P0 |
| Estimated Time | 30 min |
| Tags | `type:feat`, `scope:ui` |
```

---

## Best Practices

| # | Rule | Detail |
|---|------|--------|
| 1 | One prompt = one PR | Never combine features |
| 2 | Number filenames | `01-setup.prompt.md` |
| 3 | Machine deps | `#N`, `FI-01`, `01-filename` |
| 4 | Atomic scope | ≤30 min per prompt |
| 5 | Three test gates | tsc + lint + build minimum |
| 6 | Scope with files | `## Files to Modify` table |
| 7 | Code > prose | 5-line snippet beats paragraph |
| 8 | Blast radius grep | Search before changing values |
| 9 | a11y in every UI | aria-labels, heading order |
| 10 | Design tokens only | ⛔ No hex/rgb in components |

---

## Anti-Patterns

| ⛔ Anti-Pattern | Fix |
|-----------------|-----|
| Vague objective | Specific behavior description |
| Missing priority | Add P0-P3 |
| No testing section | Add `## Testing Checklist` |
| 4-hour scope | Split into ≤30-min prompts |
| Prose dependencies | Use `**Dependencies**: #2` |
| Freeform tags | Use UGWTF labels only |
| `**Agent Type**` field | Removed — all use Copilot |
| `## Commands` section | Use `## Testing Checklist` |
| Success criteria = commands | Describe outcome, not cmds |
| No blast radius grep | Add `## Blast Radius` |
| Hardcoded colors | Use Tailwind tokens |
| Missing data-testid | Add `## data-testid` table |
| No Agent Bootstrap | Add `## Agent Bootstrap` section |
| No workflow refs | Add `## Workflow & Lifecycle` |

---

## Tag Lifecycle Matrix

Labels applied at each stage of the UGWTF pipeline.
All labels come from `UNIVERSAL_LABELS` in `repo-registry.ts`.

### Spec Issue (`ugwtf prompts` → prompt-spec)

| Label | Source |
|-------|--------|
| `priority:p{0-3}` | Prompt `**Priority**` field |
| `automation:copilot` | Auto-applied |
| `agent:copilot` | Auto-applied |
| `prompt-spec` | Auto-applied |
| `needs-pr` | Auto-applied |
| `database` | If `hasDatabaseSchema` |

### Chain Issue (`ugwtf chain` → chain-tracker)

| Label | Source |
|-------|--------|
| `priority:p{0-3}` | From severity mapping |
| `chain-tracker` | Auto-applied |
| `prompt-chain` | From chain config |
| `automation:copilot` | From chain config |
| `agent:copilot` | From chain config |

### PR Labels (`copilot-pr-promote.yml`)

| Label | Source |
|-------|--------|
| `automation:copilot` | Auto (Copilot branch) |
| `type:{type}` | Extracted from PR title |
| `scope:{scope}` | Extracted from PR title |

### Lifecycle Transitions

| Event | Adds | Removes |
|-------|------|---------|
| Copilot assigned | `automation:in-progress` | — |
| PR fails gates | `needs-review` | — |
| PR max retries | `needs-human-review` | `automation:in-progress` |
| PR merged | `automation:completed` | `automation:in-progress` |
| Chain closed | `automation:completed` | `automation:in-progress` |

### Tags by PR Type

| PR Type | Required Labels |
|---------|----------------|
| Feature (chain) | `type:feat`, `scope:*`, `automation:copilot` |
| Fix (chain) | `type:fix`, `scope:*`, `automation:copilot` |
| Chore (manual) | `type:chore`, `scope:*` |
| Docs (manual) | `type:docs` |

---

## Placeholder Reference

Creator scripts use `{{PLACEHOLDER}}` tokens for search-replace.
This avoids markdown parsing — plain `String.replaceAll()`.

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{TITLE}}` | Issue/PR title | `Add size guide modal` |
| `{{PRIORITY}}` | P0-P3 | `P1` |
| `{{ESTIMATED_TIME}}` | Duration | `30 minutes` |
| `{{REVENUE_IMPACT}}` | Impact + reason | `High — conversion` |
| `{{DEPENDENCIES}}` | Refs | `#3, #7` |
| `{{TAGS}}` | UGWTF labels | `` `type:feat`, `scope:ui` `` |
| `{{SCOPE_INSTRUCTIONS}}` | Instruction file | `tailwind.instructions.md` |
| `{{FILE_PATH}}` | Source path | `src/shared/ui/X.tsx` |
| `{{ACTION}}` | CREATE/MODIFY | `MODIFY` |
| `{{EXISTS}}` | ✅/❌ | `✅` |
| `{{PURPOSE}}` | Why | `Add new hook` |
| `{{TESTID}}` | Test ID | `size-guide-modal` |
| `{{TESTID_ACTION}}` | CREATE/PRESERVE | `CREATE` |
| `{{TESTID_CONSUMER}}` | E2E spec | `e2e/specs/pdp.spec.ts` |
| `{{CHANGED_PATTERN}}` | Grep pattern | `SHIPPING_COST` |
| `{{EXTRA_TEST_COMMANDS}}` | Extra cmds | `npx playwright test ...` |
| `{{REFERENCE_FILE}}` | Pattern file | `src/shared/ui/Modal.tsx` |
| `{{FRAMEWORK}}` | Runtime | `Next.js 15.5.12` |
| `{{PACKAGES}}` | npm packages | `gsap, @gsap/react` |
| `{{FSD_LAYER}}` | FSD location | `features/homepage` |
| `{{DATABASE_SECTION}}` | SQL or "None" | `No DB changes required.` |
| `{{ROUTES_AFFECTED}}` | App routes | `/shop — ProductGrid` |
| `{{BLOCKING_GATE_COMMANDS}}` | Pre-reqs | `test -f src/lib/gsap.ts` |
| `{{E2E_SPEC_FILES}}` | Test specs | `e2e/specs/pdp.spec.ts` |
