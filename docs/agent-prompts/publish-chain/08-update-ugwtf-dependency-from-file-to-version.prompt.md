# PROMPT: Task 8 — Update ugwtf dependency from file: to version

**Priority**: P0  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: #7

---

## Objective

Change audit-orchestrator from "file:./packages/audit-orchestrator" to "^1.1.0" in package.json dependencies.

---

## Files to Modify

- `package.json`

---

## Commands

- `Edit package.json dependencies`

---

## Success Criteria

- [ ] grep "file:" package.json | wc -l → 0
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
