# PROMPT: Task 36 — Verify dist/index.js exports

**Priority**: P3  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: None — can run in parallel

---

## Objective

Verify both package.json exports paths resolve correctly: "." → dist/index.js, "./types" → dist/types.js.

---

## Files to Modify

- `package.json`
- `dist/index.js`

---

## Commands

- `node -e "import('./dist/index.js')"`

---

## Success Criteria

- [ ] Both export paths resolve without error
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
