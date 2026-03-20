# PROMPT: Task 37 — Check for console.log in production code

**Priority**: P3  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: None — can run in parallel

---

## Objective

Ensure only logger utility uses console. No stray console.log in agents/clusters source.

---

## Files to Modify

- `src/`

---

## Commands

- `grep -rn "console.log" src/ --include="*.ts" | grep -v ".test." | grep -v "__mocks__"`

---

## Success Criteria

- [ ] Only logger.ts uses console — no stray console.log
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
