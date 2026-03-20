# PROMPT: Task 29 — Create .npmignore

**Priority**: P3  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: None — can run in parallel

---

## Objective

Create .npmignore as defense-in-depth — excludes src/, tests/, docs/, scripts/, packages/, etc.

---

## Files to Modify

- `.npmignore`

---

## Commands

- `Create .npmignore`

---

## Success Criteria

- [ ] cat .npmignore → excludes src/, docs/, scripts/, packages/
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
