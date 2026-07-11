# /prime-orchestration-adopt — Session-init for un-queued PrimeO work

**Model:** claude-opus (orchestrator) · **Skill:** `prime-orchestrator-adopt`
**Boot script:** `documentation-standards/scripts/prime-orchestrator-adopt-boot.mts`
**Spec:** `documentation-standards/skills/prime-orchestrator-adopt/SKILL.md`
**SSOT:** `maximus-ai/docs/PRIME-ORCHESTRATOR-SSOT.md`
**Persona:** `maximus-ai/docs/PRIME-ORCHESTRATOR-PERSONA.md`
**Architecture:** `maximus-ai/docs/PRIME-ORCHESTRATOR-ARCHITECTURE.md`
**Playbook:** `documentation-standards/docs/runbooks/orchestrator-playbook.md`

Session-init entry point that boots a fresh session into PrimeO discipline
**without requiring queued CORTEX work**. The existing
`/prime-orchestration-continue*` commands all read from the standing menu; a
session that isn't yet doing tracked PrimeO work has no clean adoption path.
This command fills that gap.

## When to use

- A fresh session opens and the work is **not yet tracked** in CORTEX (no
  queued task, no standing-menu row).
- An operator wants to enter PrimeO discipline for a free-form concern before
  the work is a formal cycle.
- A `/loop`-scheduled sweep specifically to onboard un-queued concerns into
  the Prime queue.

Non-symptoms (do **not** use this command):

- The session is already picking from the queue → use
  `/prime-orchestration-continue` (or a scoped variant).
- The session has a Prime-scoped cycle to run → use
  `/prime-orchestration-continue-prime`.
- The session wants only the human-review queue → use
  `/prime-orchestration-continue-external`.

## Invocation

```
/prime-orchestration-adopt                                  # bare adoption report
/prime-orchestration-adopt --concern="short prose"          # backfill concern into queue
/prime-orchestration-adopt --scope=prime                    # set default scope
/prime-orchestration-adopt --scope=repo=maximus-ai          # set default scope to a repo
/prime-orchestration-adopt --scope=external                 # set default scope to review queue
/prime-orchestration-adopt --concern="…" --dry-run          # print planned write without touching CORTEX
/prime-orchestration-adopt --format=json                    # machine-readable output
```

Arguments pass through verbatim to
`scripts/prime-orchestrator-adopt-boot.mts`.

| Flag | Purpose |
|------|---------|
| `--concern="<text>"` | Optional. Backfills the concern as a `cortex_tasks` row (P2, pending, `prime_addressed=true`). |
| `--scope=prime\|repo=<slug>\|external` | Optional. Sets the default scope for this session. Only affects the emitted report + the concern row's `repo` field. |
| `--dry-run` | Optional. Reports what WOULD be written without touching CORTEX. Required for safe rehearsal. |
| `--format=md\|json` | Output format. Default: `md`. |

## Contract

1. Invoke the boot script:
   `npx tsx $MGMT_ROOT/documentation-standards/scripts/prime-orchestrator-adopt-boot.mts <flags>`.
2. Read the emitted adoption report:
   - Loaded persona / playbook / naming / hard-rails / verify-then-write /
     SSOT / architecture / arsenal file paths (the agent SHOULD read these
     directly next).
   - Active standing-authorization grants (counts + summary).
   - Next `BG-XXXX` tag per the naming convention (skipping tags already in
     `cortex_bg_dispatches`).
   - Recommended workflow shapes from `PRIME-WORKFLOW-ARSENAL.md`.
   - If `--concern` provided: the resulting task_id (or the planned row under
     `--dry-run`).
3. Adopt the next `BG-XXXX` tag. From here forward, honor rule 12903
   (`status='complete'` LAST, AFTER merge SHA) and the standing-authorization
   grants surfaced above.
4. If a concern was written, chain
   `/prime-orchestration-continue-prime` to enter standing-menu mode.
   Otherwise proceed with the chosen workflow shape.

## Guardrails

- **Read-only-by-default.** The script writes to CORTEX ONLY when `--concern`
  is provided AND `--dry-run` is NOT provided. All other invocations are pure
  queries.
- **NO auto-dispatch.** This command NEVER dispatches a BG. Dispatch is the
  adopting agent's job after adopting — same discipline as
  `/prime-orchestration-continue` under `--auto`.
- **NO destructive git ops** (`reset` / `rm` / `worktree remove` / force-push).
  Script never touches trees.
- **rule 12903 preserved.** Any `--concern` write uses `status='pending'` —
  the script NEVER writes `status='complete'`.
- **Portable.** No hardcoded paths; `$MGMT_ROOT` resolved from
  `MANAGEMENT_GIT_ROOT` / `MGMT_ROOT` / `~/management-git`.

## Composition example

```
Session opens in a repo for a new concern
  → /prime-orchestration-adopt --concern="MCP tool foo throws under bar" --scope=repo=maximus-ai
  → task_prime_orchestrator_adopt_mcp_tool_foo_throws_20260710 created (P2, pending, prime_addressed=true)
  → adopts BG-XXXX per the next-tag report
  → /prime-orchestration-continue-prime  (now standing-menu mode)
  → picks up the just-created row and dispatches per Playbook Patterns A-I
```

## Change Log

- 2026-07-10 — Initial. Fills the gap between session start and the
  standing-menu discipline that `/prime-orchestration-continue*` requires.
  Tracker: `task_prime_orchestration_adopt_delivered_20260710`.
