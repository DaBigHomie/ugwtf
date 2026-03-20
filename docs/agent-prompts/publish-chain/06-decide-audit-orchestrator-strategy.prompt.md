# PROMPT: Task 6 — Decide audit-orchestrator strategy

**Priority**: P0  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: None — can run in parallel

---

## Objective

Decision: Publish @dabighomie/audit-orchestrator separately (Option A). External users cannot resolve file: protocol dependencies.

---

## Files to Modify

- `package.json`

---

## Commands

- `Decision already made: Option A — publish separately`

---

## Success Criteria

- [ ] N/A — decision task
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
