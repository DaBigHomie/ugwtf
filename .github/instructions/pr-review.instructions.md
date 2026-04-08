---
applyTo: "**"
---

# Pull Request Review Workflow

> Managed by DaBigHomie/documentation-standards — do not edit in target repos.

## ⚠️ 30x Principle: No Shortcuts, No Workarounds

When reviewing or fixing PR feedback, **always use the 30x recommended solution**. Never take shortcuts or suggest workarounds. If Copilot review flags an issue, fix it properly — don't suppress, ignore, or work around it.

## Step 0: Load Instruction Hierarchy (MANDATORY)

Before reviewing or addressing review comments, load in this order:

1. **Repository-Wide**: `cat .github/copilot-instructions.md`
2. **Agent Instructions**: `cat .github/agents/code-review.agent.md`
3. **Path-Specific**: Load `.github/instructions/*.instructions.md` matching changed file paths

| Changed Path | Load |
|---|---|
| `src/**/*.tsx` | `typescript`, `design-system`, `hydration-safety`, `tailwind`, `regression-prevention` |
| `src/features/**` | `fsd-architecture`, `animations`, `cards-grids` |
| `src/app/**` | `app-router` |
| `e2e/**` | `test-30x` |
| `.github/workflows/**` | `workflow-syntax` |

> Copilot code review reads only the **first 4,000 characters** of each instruction file. Front-load critical rules.

## MANDATORY: Check Copilot Review Feedback

Before approving ANY PR:

1. CHECK for Copilot reviews
2. READ all inline comments from @copilot-pull-request-reviewer
3. FIX all identified issues — don't merge with open concerns
4. VALIDATE fixes — run TypeScript, ESLint, tests
5. COMMIT fixes with evidence
6. PUSH to update the PR branch
7. APPROVE & MERGE only after all issues resolved

## How to Check Copilot Reviews

```bash
gh pr view [PR_NUMBER] --json reviews,comments
gh api repos/[OWNER]/[REPO]/pulls/[PR_NUMBER]/comments --jq '.[] | {path: .path, line: .line, body: .body}'
```

## Review Gates (Mandatory Checks)

**Code Quality**:
- TypeScript: 0 errors (`npx tsc --noEmit`)
- ESLint: 0 errors (`npm run lint`)
- Build succeeds (`npm run build`)
- All Copilot review comments addressed
- Commit message follows `{type}({scope}): {description}`

**Blast Radius**:
- For every changed value (prices, thresholds, constants): `grep -rn 'OLD_VALUE' src/`
- All files displaying changed values are updated in the same PR

**Accessibility**:
- Interactive elements have `aria-label`
- Heading hierarchy sequential (no skipped levels)
- Color contrast meets WCAG AA

**Design System**:
- No hardcoded hex/rgb — uses CSS variables or Tailwind tokens
- No inline styles for layout
- Dark mode variants present on visible elements

**data-testid**:
- Existing testids NOT renamed/removed without updating E2E specs
- New interactive elements have testids

**Architecture**:
- FSD imports are one-way (app → widgets → features → entities → shared)
- No cross-feature imports
- No hardcoded colors — uses theme tokens

## Common Copilot Review Issues

- Accessibility: Missing aria-labels, keyboard navigation
- UX: No-op buttons (onClick without handler), broken interactions
- API Compatibility: Breaking changes to hooks/functions
- Naming: camelCase vs snake_case mismatches
- Configuration: Missing constants, hardcoded values
- Workflow Syntax: `${{ }}` in YAML comments (GitHub Actions parse error)
