# PROMPT: Task 2 — Remove __mocks__ from dist

**Priority**: P0  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: #1

---

## Objective

Verify dist/__mocks__/ no longer exists after tsconfig fix. Mock files (github.js, logger.js) must not ship to production users.

---

## Files to Modify

- `tsconfig.json`

---

## Commands

- `Covered by Task 1 tsconfig exclude`

---

## Success Criteria

- [ ] ls dist/__mocks__/ 2>/dev/null → "No such file or directory"
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
