# PROMPT: Task 11 — Add repository field to package.json

**Priority**: P0  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: None — can run in parallel

---

## Objective

Add repository, bugs, and homepage fields to package.json for npm page linking.

---

## Files to Modify

- `package.json`

---

## Commands

- `Edit package.json — add repository, bugs, homepage`

---

## Success Criteria

- [ ] grep "repository" package.json → present
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
