# PROMPT: Task 35 — Run npm audit on dependencies

**Priority**: P2  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: None — can run in parallel

---

## Objective

Check for 0 vulnerabilities in production dependencies.

---

## Files to Modify

- N/A

---

## Commands

- `npm audit`
- `npm audit --omit=dev`

---

## Success Criteria

- [ ] npm audit → 0 vulnerabilities in production deps
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
