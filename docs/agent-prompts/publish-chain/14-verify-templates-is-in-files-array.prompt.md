# PROMPT: Task 14 — Verify templates/ is in files array

**Priority**: P2  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: None — can run in parallel

---

## Objective

Confirm templates/ugwtf-workflow.instructions.md will be included in tarball via files array.

---

## Files to Modify

- `package.json`

---

## Commands

- `npm pack --dry-run 2>&1 | grep templates`

---

## Success Criteria

- [ ] npm pack --dry-run output includes templates/
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
