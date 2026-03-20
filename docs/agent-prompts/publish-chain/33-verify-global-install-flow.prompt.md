# PROMPT: Task 33 — Verify global install flow

**Priority**: P2  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: None — can run in parallel

---

## Objective

Pre-publish: verify shebang in dist/index.js and bin entry in package.json are correct.

---

## Files to Modify

- `dist/index.js`
- `package.json`

---

## Commands

- `head -1 dist/index.js`
- `grep bin package.json`

---

## Success Criteria

- [ ] dist/index.js starts with #!/usr/bin/env node
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
