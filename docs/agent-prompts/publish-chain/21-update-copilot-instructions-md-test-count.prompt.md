# PROMPT: Task 21 — Update copilot-instructions.md test count

**Priority**: P1  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: None — can run in parallel

---

## Objective

Fix "261+ tests" (2 occurrences) and "15 files" → "383 tests across 20 files" in .github/copilot-instructions.md.

---

## Files to Modify

- `.github/copilot-instructions.md`

---

## Commands

- `Edit copilot-instructions.md`

---

## Success Criteria

- [ ] grep "383" .github/copilot-instructions.md | wc -l ≥ 2
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
