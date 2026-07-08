# /continue-cycles — Orchestrator-handoff entry-point

**Model:** claude-opus (orchestrator) · **Skill:** `orchestrator-continuation`
**Spec:** `documentation-standards/skills/orchestrator-continuation/SKILL.md`
**Runbook:** `documentation-standards/docs/runbooks/orchestrator-continuation.md`

Loads the Standing menu (pending / in_progress / blocked CORTEX tasks + session
markers + stale-worktree candidates + external-gate PRs) and either PROMPTS
the user for a pick or (with `--auto`) dispatches the top **Quick-Win** cycle.
Standard / Larger / External cycles ALWAYS require an explicit human pick.

## Invocation

```
/continue-cycles                              # print Standing menu (markdown), prompt user
/continue-cycles --auto                       # print menu + auto-dispatch top Quick-Win only
/continue-cycles --session=polaris-bootstrap-20260607
/continue-cycles --repo=documentation-standards --format=json
/continue-cycles --all-sessions
```

## Contract

1. Run the boot script:
   `npx tsx $MGMT_ROOT/documentation-standards/scripts/orchestrator-continuation-boot.mts <flags>`.
2. Read the emitted menu — do NOT rebuild it from memory.
3. If `--auto`: dispatch the `DISPATCH_CANDIDATE` line's task via Patterns A-I
   (runbook §5). Otherwise ask the user which row to pick.
4. Compose `forecast-scrutiny` + `repo-sync-guard` BEFORE any dispatch.
5. `malfig-ship` handles the downstream PR/gate/merge flow when the picked
   cycle produces a PR.

## Guardrails

- `--auto` scope is **Quick wins only** — enforced by the boot script filter.
- No destructive git ops (`reset` / `rm` / `worktree remove` / force-push).
- Never write to CORTEX beyond a self-index task.
- Skill and boot script are **portable** (`$MGMT_ROOT`); no hardcoded paths.
