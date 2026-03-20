# PROMPT: Task 19 — Verify LICENSE in npm tarball

**Priority**: P3  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: #16

---

## Objective

npm automatically includes LICENSE in tarball even without files array entry. Verify this is the case.

---

## Files to Modify

- `package.json`

---

## Commands

- `npm pack --dry-run 2>&1 | grep -i license`

---

## Success Criteria

- [ ] npm pack --dry-run output includes LICENSE
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
