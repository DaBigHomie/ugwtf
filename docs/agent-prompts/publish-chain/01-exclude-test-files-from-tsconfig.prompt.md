# PROMPT: Task 1 — Exclude test files from tsconfig

**Priority**: P0  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: None — can run in parallel

---

## Objective

Add *.test.ts and __mocks__/ to tsconfig.json exclude array to prevent 40 test files from being compiled into dist/, bloating tarball by ~400 KB.

---

## Files to Modify

- `tsconfig.json`

---

## Commands

- `Edit tsconfig.json exclude array`

---

## Success Criteria

- [ ] npm run build && find dist -name "*.test.*" | wc -l → 0
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
