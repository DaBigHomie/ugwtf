# PROMPT: Task 18 — Reconcile README license section

**Priority**: P2  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: #16

---

## Objective

README says "Private — DaBigHomie" in License section. Must update to MIT to match package.json and LICENSE file.

---

## Files to Modify

- `README.md`

---

## Commands

- `Update License section in README.md`

---

## Success Criteria

- [ ] grep -A2 "## License" README.md → contains "MIT"
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
