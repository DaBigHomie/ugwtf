# PROMPT: Task 13 — Run npm pkg fix

**Priority**: P2  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: None — can run in parallel

---

## Objective

Fix npm publish warning about bin[ugwtf] script name being cleaned.

---

## Files to Modify

- `package.json`

---

## Commands

- `npm pkg fix`
- `git diff package.json`

---

## Success Criteria

- [ ] npm publish --dry-run 2>&1 | grep -i "cleaned" | wc -l → 0
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
