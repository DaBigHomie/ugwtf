# UGWTF — Known Gaps & Improvements

Identified during 30x deep dive audit (March 2026).

## Test Coverage Gaps

| Gap | Severity | Status | Notes |
|-----|----------|--------|-------|
| `prompt-agents.test.ts` | ~~High~~ | ✅ Fixed | 54 unit tests added — covers validatePrompt, parseDependencies, scanAllPrompts |
| Copilot assignment failures | ~~Critical~~ | ✅ Fixed | 5 fixes: fetch transport when `GITHUB_TOKEN`/`GH_TOKEN` set (otherwise `gh` fallback which may silently fail), rate limiting, verification, PR quality gate, CLI flags |
| Real chain file tests | ~~Medium~~ | ✅ Fixed | 11 tests validate `projects/o43/prompt-chain.json` structure, deps, waves |
| `pr-agents.test.ts` | ~~Medium~~ | ✅ Fixed | 25 unit tests — PR review, DB firewall, batch processor, completion tracker |
| `issue-agents.test.ts` | ~~Medium~~ | ✅ Fixed | 29 unit tests — stalled detector, Copilot assign, auto-triage |
| Generator output tests | Low | Open | YAML generators produce static templates, low risk of regression |
| Plugin loader tests | Low | Open | Extensibility feature not yet used in production |

## Agent Coverage Summary

| Agent File | Has Tests? | Test Count |
|------------|-----------|------------|
| `prompt-agents.ts` | ✅ | 54 |
| `chain-agents.ts` | ✅ | 26 |
| `issue-agents.ts` | ✅ | 29 |
| `pr-agents.ts` | ✅ | 25 |
| `fix-agents.ts` | ✅ | 25 |
| `audit-agents.ts` | ✅ | 17 |
| `label-agents.ts` | ✅ | 15 |

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

1. **Document `.ugwtfrc` format** — Show example RC file with all fields
2. **Add generator snapshot tests** — Snapshot YAML output to catch template drift
