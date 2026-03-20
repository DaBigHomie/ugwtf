# PROMPT: Task 40 — npm publish v1.0.0

**Priority**: P0  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: #39

---

## Objective

Tag v1.0.0, push, and publish @dabighomie/ugwtf to npm public registry.

---

## Files to Modify

- `package.json`

---

## Commands

- `git tag v1.0.0`
- `git push origin main --tags`
- `npm publish --access public`

---

## Success Criteria

- [ ] npm info @dabighomie/ugwtf → version 1.0.0
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
