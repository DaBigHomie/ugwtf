# PROMPT: Task 20 — Update AGENTS.md test count

**Priority**: P1  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: None — can run in parallel

---

## Objective

Fix 3 occurrences of "272 tests across 15 test files" → "383 tests across 20 test files" in AGENTS.md.

---

## Files to Modify

- `AGENTS.md`

---

## Commands

- `sed replacements in AGENTS.md`

---

## Success Criteria

- [ ] grep "383" AGENTS.md | wc -l ≥ 3
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
