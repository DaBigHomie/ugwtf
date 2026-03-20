# PROMPT: Task 3 — Rebuild dist after tsconfig fix

**Priority**: P0  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: #1, #2

---

## Objective

Clean rebuild to verify test files and mocks are excluded from dist/. Target: ~600 KB dist (down from 1.2 MB).

---

## Files to Modify

- `dist/`

---

## Commands

- `npm run build`
- `find dist -name "*.test.*" | wc -l`
- `du -sh dist`

---

## Success Criteria

- [ ] find dist -name "*.test.*" | wc -l → 0 && find dist -name "__mocks__" | wc -l → 0
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
