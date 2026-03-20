# PROMPT: Task 12 — Add engines field to package.json

**Priority**: P1  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: None — can run in parallel

---

## Objective

Add engines.node >= 20.0.0 to package.json so users know minimum Node version.

---

## Files to Modify

- `package.json`

---

## Commands

- `Edit package.json — add engines field`

---

## Success Criteria

- [ ] grep "engines" package.json → present
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
