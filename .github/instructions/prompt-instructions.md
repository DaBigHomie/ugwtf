---
applyTo: "**/prompts/**,**/*.prompt.md,**/agent-prompts/**"
---

# Prompt Authoring Instructions

> Gold-standard format for `.prompt.md` files consumed by UGWTF prompt agents.
> Prompts that follow this format score 100/100 and execute reliably via Copilot coding agents.

---

## Optimal Format Template

Every `.prompt.md` file MUST follow this structure:

```markdown
# [Clear, Descriptive Task Title]

**Priority**: P0
**Status**: ⏳ **NOT STARTED**
**Estimated Time**: 10-30 minutes
**Agent Type**: Copilot Coding Agent
**Revenue Impact**: High
**Dependencies**: #3, #7

---

## Objective

[One paragraph: What this prompt accomplishes and WHY it matters.
Must be >20 characters. This is the highest-weighted criterion — the agent
reads this first to understand the task.]

---

## Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/example.ts` | Modify | Add validation logic |
| `src/lib/example.test.ts` | Create | Unit tests |

---

## Commands

```bash
npm install some-package
npx tsc --noEmit
```

---

## Success Criteria

- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] `npm run lint` passes with 0 errors
- [ ] `npm run build` succeeds
- [ ] New function exported and callable
- [ ] Unit tests cover happy path + error cases

---

## Testing Checklist

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx vitest run` — all tests pass
- [ ] `npm run build` — succeeds with 0 warnings

---

## Implementation

### Step 1: [Action]

[Detailed instructions with exact file paths and code changes.]

```typescript
// Example code showing the expected implementation
export function myFunction(): string {
  return 'example';
}
```

### Step 2: [Action]

[Continue with specific, actionable steps.]

---

## Reference Implementation

See `src/existing/pattern.ts` for the established pattern this prompt follows.
```

---

## 18-Criterion Scoring (125 points max)

The UGWTF validator scores every prompt against these 18 criteria.
Prompts must score **≥99.9%** to pass the quality gate.

| # | Criterion | Points | What It Checks |
|---|-----------|--------|----------------|
| 1 | **Title** | 10 | 6-119 chars, clear and descriptive — becomes GitHub Issue title |
| 2 | **Priority** | 10 | P0-P3 assigned — controls chain ordering |
| 3 | **Objective** | 15 | >20 chars detailed description — HIGHEST weight, agent reads first |
| 4 | **Sections** | 10 | ≥4 `## Heading` sections — structured prompts reduce hallucination |
| 5 | **Success Criteria** | 10 | `## Success Criteria` with checkboxes — quality gates verify these |
| 6 | **Testing Checklist** | 10 | `## Testing Checklist` — commands agent runs before pushing |
| 7 | **Code Examples** | 10 | Fenced code blocks (```typescript, ```bash, etc.) — reduces ambiguity |
| 8 | **Time Estimate** | 5 | `**Estimated Time**` present — used by forecaster for 30x readiness |
| 9 | **Revenue Impact** | 5 | `**Revenue Impact**` present — prioritization signal |
| 10 | **Checklists** | 5 | ≥3 `- [ ]` items — granular acceptance criteria |
| 11 | **Reference Impl** | 5 | "Reference Implementation" mentioned — points agent at patterns |
| 12 | **Content Depth** | 5 | ≥100 lines — deeper prompts produce better results |
| 13 | **Files to Modify** | 5 | `## Files to Modify/Create/Touch` section — scopes agent work |
| 14 | **Tags / Labels** | 3 | `**Tags**` or `**Labels**` present — enables auto-labeling |
| 15 | **Environment** | 5 | `## Environment` section — tools, versions, runtime context |
| 16 | **Blocking Gate** | 5 | `## Blocking Gate` section — hard prerequisite check |
| 17 | **Merge Gate** | 5 | `## Merge Gate` section — conditions that must pass before merge |
| 18 | **Dependencies** | 2 | `**Dependencies**` lists specific prompt/issue refs |

**Total: 125 points**

### Validation Command

```bash
npx tsx scripts/validate-prompts.mts --cwd <repo-path> --verbose
```

---

## Metadata Formats (Both Supported)

### Format 1: Inline (Preferred)

```markdown
**Priority**: P0
**Estimated Time**: 30 minutes
**Revenue Impact**: High
```

### Format 2: Table

```markdown
## Metadata
| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Estimated Hours** | 3h |
| **Revenue Impact** | High |
```

The validator auto-detects and extracts from either format.

---

## 30x Best Practices

### 1. One Task = One Prompt = One Issue = One PR

Each prompt file maps to exactly one GitHub Issue, assigned to one agent,
producing one PR. Never combine multiple features into one prompt.

### 2. Number Filenames for Ordering

```
01-supabase-client-setup.prompt.md
02-product-schema.prompt.md
03-cart-state-management.prompt.md
```

The number prefix controls execution order and makes dependency chains obvious.

### 3. Make Dependencies Explicit and Machine-Parseable

```markdown
**Dependencies**: #1, #3
```

UGWTF's dependency parser extracts `#N` references, `FI-01` IDs, and
`01-filename` patterns. Use these formats — not prose.

### 4. Put Exact Commands in Success Criteria

```markdown
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] `npm run build` succeeds
```

Not: "TypeScript should compile" — give the agent the exact command.

### 5. Keep Prompts Atomic (Under 30 Minutes)

If estimated time exceeds 30 minutes, split into smaller prompts.
Smaller scope = fewer hallucinations = higher success rate.

### 6. Always Include Testing Checklist with Three Gates

Every prompt must specify these three minimum quality gates:

```markdown
## Testing Checklist
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx vitest run` — all tests pass
- [ ] `npm run build` — succeeds
```

### 7. Use `## Files to Modify` to Scope the Agent

Listing exact file paths prevents the agent from wandering into unrelated code.

```markdown
## Files to Modify
| File | Action | Purpose |
|------|--------|---------|
| `src/lib/supabase.ts` | Modify | Add new query function |
```

### 8. Include Code Examples for Non-Obvious Changes

A 5-line code snippet eliminates ambiguity better than a paragraph of description.

```markdown
## Implementation

```typescript
export async function getProducts(): Promise<Product[]> {
  const { data } = await supabase.from('products').select('*');
  return data ?? [];
}
```​
```

### 9. Group Prompts into Waves via Dependencies

UGWTF uses Kahn's algorithm (topological sort) to determine execution waves.
Prompts with no dependencies run first (Wave 1). Prompts depending on Wave 1
run next (Wave 2), and so on.

```
Wave 1: 01-setup, 02-schema (no deps)
Wave 2: 03-cart (depends on #1, #2)
Wave 3: 04-checkout (depends on #3)
```

### 10. Design for Self-Healing Failure

When a prompt fails, the agent retries. Make this work by:
- Clear success criteria with exact commands (not ambiguous descriptions)
- Small scope (one responsibility per prompt)
- Testing checklist the agent can execute independently

---

## Anti-Patterns (Avoid These)

- **Vague objectives**: "Improve the codebase" — be specific
- **Missing priority**: Every prompt needs P0-P3 for ordering
- **No testing section**: Agent has no way to verify its own work
- **Massive scope**: 4-hour prompts fail; split into 30-minute chunks
- **Prose dependencies**: "This should be done after the database work" — use `**Dependencies**: #2`
- **No code examples**: Agent guesses the implementation pattern
- **Missing files list**: Agent modifies random files looking for the right ones
