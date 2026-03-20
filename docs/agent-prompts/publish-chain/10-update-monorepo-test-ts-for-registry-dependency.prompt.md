# PROMPT: Task 10 — Update monorepo.test.ts for registry dependency

**Priority**: P0  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: #8

---

## Objective

Update test that checks file: dependency to verify ^1.1.0 instead. Keep structure/type-contract/build-artifacts/exports/runtime tests intact.

---

## Files to Modify

- `src/monorepo.test.ts`

---

## Commands

- `Edit monorepo.test.ts`

---

## Success Criteria

- [ ] npx vitest run src/monorepo.test.ts → all pass
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
