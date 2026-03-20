# PROMPT: Task 9 — Clean install to verify external resolution

**Priority**: P0  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: #8

---

## Objective

Remove node_modules and package-lock.json, fresh install to verify audit-orchestrator resolves from npm registry.

---

## Files to Modify

- `package.json`
- `package-lock.json`

---

## Commands

- `rm -rf node_modules package-lock.json`
- `npm install`
- `npx tsc --noEmit`
- `npx vitest run`

---

## Success Criteria

- [ ] npm install succeeds && npx tsc --noEmit → 0 errors && npx vitest run → 383 passed
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
