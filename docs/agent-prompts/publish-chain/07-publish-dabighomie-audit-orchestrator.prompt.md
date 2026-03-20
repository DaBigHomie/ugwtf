# PROMPT: Task 7 — Publish @dabighomie/audit-orchestrator

**Priority**: P0  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: #6

---

## Objective

Publish audit-orchestrator v1.1.0 to npm as a separate public package. Has dist/ already built and prepublishOnly script.

---

## Files to Modify

- `packages/audit-orchestrator/package.json`

---

## Commands

- `cd packages/audit-orchestrator`
- `npm publish --dry-run`
- `npm publish --access public`

---

## Success Criteria

- [ ] npm info @dabighomie/audit-orchestrator → shows version 1.1.0
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
