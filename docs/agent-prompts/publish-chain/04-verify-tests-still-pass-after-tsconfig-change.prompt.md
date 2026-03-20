# PROMPT: Task 4 — Verify tests still pass after tsconfig change

**Priority**: P0  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: #3

---

## Objective

Vitest uses its own config (vitest.config.ts), not tsconfig — but must confirm all 383 tests still pass and TypeScript reports 0 errors.

---

## Files to Modify

- `vitest.config.ts`

---

## Commands

- `npx vitest run`
- `npx tsc --noEmit`

---

## Success Criteria

- [ ] npx vitest run → 383 passed, 20 files && npx tsc --noEmit → 0 errors
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
