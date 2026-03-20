# PROMPT: Task 17 — Create LICENSE file for audit-orchestrator

**Priority**: P1  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: #7

---

## Objective

Create LICENSE file for packages/audit-orchestrator/ with same MIT text.

---

## Files to Modify

- `packages/audit-orchestrator/LICENSE`

---

## Commands

- `Create packages/audit-orchestrator/LICENSE`

---

## Success Criteria

- [ ] cat packages/audit-orchestrator/LICENSE → MIT text present
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
