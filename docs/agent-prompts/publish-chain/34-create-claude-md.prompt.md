# PROMPT: Task 34 — Create CLAUDE.md

**Priority**: P3  
**Status**: ⏳ **NOT STARTED**  
**Estimated Time**: 10-30 minutes  
**Agent Type**: Copilot Coding Agent  
**Dependencies**: None — can run in parallel

---

## Objective

Create CLAUDE.md for Claude Code users with quick-start pointing to AGENTS.md and docs/agent-guide/.

---

## Files to Modify

- `CLAUDE.md`

---

## Commands

- `Create CLAUDE.md`

---

## Success Criteria

- [ ] cat CLAUDE.md → contains "AGENTS.md"
- [ ] TypeScript: `npx tsc --noEmit` → 0 errors
- [ ] Tests: `npx vitest run` → 383+ passed

---

## Testing Checklist

- [ ] Verify fix applied correctly
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Run tests: `npx vitest run`
- [ ] Run build: `npm run build`
