# PROMPT: Task 25 — Fix AUDIT-RESULTS.json hardcoded paths

**Priority**: P2  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: None — can run in parallel

---

## Objective

Replace 5 occurrences of /Users/dame/management-git/ugwtf/src/... with relative paths src/...

---

## Files to Modify

- `docs/AUDIT-RESULTS.json`

---

## Commands

- `sed -i replacement in AUDIT-RESULTS.json`

---

## Success Criteria

- [ ] grep "/Users/" docs/AUDIT-RESULTS.json | wc -l → 0
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
