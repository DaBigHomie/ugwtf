# PROMPT: Task 30 — Verify release.yml workflow

**Priority**: P2  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: None — can run in parallel

---

## Objective

Check .github/workflows/release.yml uses NPM_TOKEN secret and runs build before publish.

---

## Files to Modify

- `.github/workflows/release.yml`

---

## Commands

- `cat .github/workflows/release.yml`

---

## Success Criteria

- [ ] Workflow uses NPM_TOKEN and builds before publish
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
