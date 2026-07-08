# /prime-orchestration-continue — Family-prefixed alias for /continue-cycles

**Model:** claude-opus (orchestrator) · **Skill:** `orchestrator-continuation`
**Spec:** `documentation-standards/skills/orchestrator-continuation/SKILL.md`
**Runbook:** `documentation-standards/docs/runbooks/orchestrator-continuation.md`
**Family runbook:** `documentation-standards/docs/runbooks/prime-orchestration-commands.md` §5.5

Family-prefixed alias for the existing `/continue-cycles` command
(documentation-standards#73) — same skill, same boot script, same rails.
Purpose is family consistency: users can reach the Standing menu via either
`/continue-cycles` (legacy) or `/prime-orchestration-continue` (family form).

## Invocation

```
/prime-orchestration-continue                              # print Standing menu (markdown), prompt user
/prime-orchestration-continue --auto                       # print menu + auto-dispatch top Quick-Win only
/prime-orchestration-continue --session=polaris-bootstrap-20260607
/prime-orchestration-continue --repo=documentation-standards --format=json
/prime-orchestration-continue --all-sessions
```

Argument surface is identical to `/continue-cycles` — see that command file
for the canonical contract.

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
- **Alias parity.** If the underlying `/continue-cycles` contract changes,
  this command's contract updates in the same PR — the two files must stay
  in lockstep.
