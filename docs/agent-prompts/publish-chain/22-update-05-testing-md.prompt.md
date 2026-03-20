# PROMPT: Task 22 — Update 05-TESTING.md

**Priority**: P1  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: None — can run in parallel

---

## Objective

Fix "261 tests across 15 files" → "383 tests across 20 files". Add the 5 new test files from PR #10.

---

## Files to Modify

- `docs/agent-guide/05-TESTING.md`

---

## Commands

- `Edit 05-TESTING.md`

---

## Success Criteria

- [ ] grep "383" docs/agent-guide/05-TESTING.md → present
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
