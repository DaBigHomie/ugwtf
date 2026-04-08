---
applyTo: "**"
---

# Testing Instructions — ugwtf

> Framework: Node.js
> [TODO: Add app-specific test paths, coverage targets, and CI gate configuration]

## Standardized Test Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `npm test` | `[TODO: unit test command]` | Unit tests (all) |
| `npm run test:watch` | `[TODO: watch command]` | Unit tests (watch mode) |
| `npm run test:coverage` | `[TODO: coverage command]` | Unit tests + coverage |
| `npm run test:e2e` | `playwright test --project=chromium-desktop` | E2E tests |
| `npm run type-check` | `tsc --noEmit` | TypeScript type checking |

## File-Change → Test-Suite Mapping

When an agent modifies files, run the corresponding test suites:

### Source Changes → Unit Tests

Trigger when ANY of these change:
- `src/**/*.ts`, `src/**/*.tsx` — source files
- `**/*.test.ts`, `**/*.test.tsx` — test files
- `**/*.spec.ts`, `**/*.spec.tsx` — spec files

[TODO: Add repo-specific file patterns that trigger specific test suites]

### E2E Tests

Trigger when ANY of these change:
- `src/**/*.tsx` — React components (visual regression)
- `src/**/page*`, `src/**/Page*` — page components
- [TODO: Add repo-specific E2E trigger paths]

## Quality Gates (in order)

1. `tsc --noEmit` — 0 errors
2. `[TODO: lint command]` — 0 errors
3. `[TODO: unit test command]` — all pass
4. `playwright test --project=chromium-desktop` — all pass (before merge)

## Agent Test Execution Rules

- ✅ Run unit tests after every source file change
- ✅ Run E2E before opening a PR
- ❌ Never skip type-check — it catches real bugs
- ❌ Never mark a task complete with failing tests
- ❌ Never delete tests to make them pass

[TODO: Add repo-specific testing patterns, mocks, fixtures, and conventions]
