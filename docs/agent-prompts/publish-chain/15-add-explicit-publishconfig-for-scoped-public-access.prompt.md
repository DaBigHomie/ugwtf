# PROMPT: Task 15 — Add explicit publishConfig for scoped public access

**Priority**: P2  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: None — can run in parallel

---

## Objective

Add publishConfig.access = "public" so npm publish works without --access public flag.

---

## Files to Modify

- `package.json`

---

## Commands

- `Edit package.json — add publishConfig`

---

## Success Criteria

- [ ] grep "publishConfig" package.json → present
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
