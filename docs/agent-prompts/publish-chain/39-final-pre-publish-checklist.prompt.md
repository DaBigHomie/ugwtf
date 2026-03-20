# PROMPT: Task 39 — Final pre-publish checklist

**Priority**: P0  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, #15, #16, #17, #18, #19, #20, #21, #22, #23, #24, #25, #26, #27, #28, #29, #30, #31, #32, #33, #34, #35, #36, #37, #38

---

## Objective

Run every quality gate: tsc, lint, build, vitest, publish --dry-run. Verify LICENSE, CHANGELOG, repository, engines fields, no file: deps, test files excluded.

---

## Files to Modify

- `package.json`

---

## Commands

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npx vitest run`
- `npm publish --dry-run`

---

## Success Criteria

- [ ] ALL gates green — 0 errors, 0 test files in dist, LICENSE exists, CHANGELOG exists
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
