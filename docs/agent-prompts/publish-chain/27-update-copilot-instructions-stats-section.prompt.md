# PROMPT: Task 27 — Update copilot-instructions stats section

**Priority**: P2  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: None — can run in parallel

---

## Objective

Align all stats in .github/copilot-instructions.md (86 agents, 35 clusters, 383 tests, 20 files).

---

## Files to Modify

- `.github/copilot-instructions.md`

---

## Commands

- `Edit copilot-instructions.md stats`

---

## Success Criteria

- [ ] grep "86 agents" .github/copilot-instructions.md → present
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
