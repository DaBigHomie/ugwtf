# PROMPT: Task 38 — Verify all repo configs load correctly

**Priority**: P3  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: None — can run in parallel

---

## Objective

Run status command for all 6 registered repos (including ugwtf self-target) to verify config loading.

---

## Files to Modify

- `src/config/repo-registry.ts`

---

## Commands

- `npx tsx src/index.ts status ugwtf --dry-run`

---

## Success Criteria

- [ ] All 6 repo configs resolve without error
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
