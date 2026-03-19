# UGWTF — Known Gaps & Improvements

Identified during 30x deep dive audit (March 2026).

## Test Coverage Gaps

| Gap | Severity | Status | Notes |
|-----|----------|--------|-------|
| `prompt-agents.test.ts` | ~~High~~ | ✅ Fixed | 54 unit tests added — covers validatePrompt, parseDependencies, scanAllPrompts |
| Real chain file tests | ~~Medium~~ | ✅ Fixed | 11 tests validate `projects/o43/prompt-chain.json` structure, deps, waves |
| `pr-agents.test.ts` | Medium | Open | PR review, DB firewall, batch processor, completion tracker — no unit tests |
| `issue-agents.test.ts` | Medium | Open | Stalled detector, Copilot assign, auto-triage — no unit tests |
| Generator output tests | Low | Open | YAML generators produce static templates, low risk of regression |
| Plugin loader tests | Low | Open | Extensibility feature not yet used in production |

## Agent Coverage Summary

| Agent File | Has Tests? | Test Count |
|------------|-----------|------------|
| `prompt-agents.ts` | ✅ | 54 |
| `chain-agents.ts` | ✅ | 22 |
| `pr-agents.ts` | ❌ | 0 |
| `issue-agents.ts` | ❌ | 0 |
| `label-agents.ts` | ❌ | 0 |
| `audit-agents.ts` | ❌ | 0 |
| `fix-agents.ts` | ❌ | 0 |

## Integration Gaps (Closed)

| Gap | Status | Resolution |
|-----|--------|------------|
| No `.github/copilot-instructions.md` | ✅ Fixed | Created — agents now get full context when working in ugwtf |
| `validatePrompt` not wired into chain | ✅ Fixed | chainGenerator now scores all prompts and warns on <50% quality |
| Tests don't validate real chain files | ✅ Fixed | 11 tests validate o43 chain (30 entries, 4 waves, dep integrity) |

## Feature Gaps

| Feature | Impact | Notes |
|---------|--------|-------|
| No `ugwtf` global binary | Low | Must use `npx tsx src/index.ts`. npm `bin` field exists but not tested globally |
| No watch mode for agents | Low | File watcher exists (`src/watch/`) but not connected to agent re-runs |
| Plugin system unused | Low | `src/plugins/loader.ts` exists but no plugins registered |
| No agent dependency chain | Medium | Agents run in parallel within cluster but can't express inter-agent deps |

## Documentation Gaps

| Gap | Status |
|-----|--------|
| Generator output examples | Open — no sample YAML shown for each generator |
| `.ugwtfrc` file format | Open — RC loader exists but config format undocumented |
| Per-repo config overrides | Open — `mergeRepoConfig()` exists but not documented |

## Recommended Next Steps

1. **Write `pr-agents.test.ts`** — Mock Octokit, test DB migration detection + label logic
2. **Write `issue-agents.test.ts`** — Test keyword matching, stalled detection logic
3. **Document `.ugwtfrc` format** — Show example RC file with all fields
4. **Add generator snapshot tests** — Snapshot YAML output to catch template drift
