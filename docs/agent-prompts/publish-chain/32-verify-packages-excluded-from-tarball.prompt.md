# PROMPT: Task 32 — Verify packages/ excluded from tarball

**Priority**: P3  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: None — can run in parallel

---

## Objective

Confirm packages/ directory is NOT in npm tarball (not in files array).

---

## Files to Modify

- `package.json`

---

## Commands

- `npm pack --dry-run 2>&1 | grep packages`

---

## Success Criteria

- [ ] npm pack --dry-run output does NOT include packages/
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
