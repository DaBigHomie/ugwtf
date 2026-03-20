# PROMPT: Task 5 — Run npm publish dry run post-rebuild

**Priority**: P0  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: #4

---

## Objective

Verify tarball size reduced to ~80 KB compressed / ~95 files, with NO test files in listing.

---

## Files to Modify

- `package.json`

---

## Commands

- `npm publish --dry-run 2>&1 | head -30`
- `npm pack --dry-run 2>&1 | tail -20`

---

## Success Criteria

- [ ] File count ~95, compressed size ~80 KB, NO test files in listing
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
