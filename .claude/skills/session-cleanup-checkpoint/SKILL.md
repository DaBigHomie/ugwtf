---
name: session-cleanup-checkpoint
description: >
  Read-only git + worktree forensics, a NON-DESTRUCTIVE session-cleanup plan, and a durable
  checkpoint — for safely winding down or handing off a coding session without clobbering other
  agents' work. Use this whenever the user says "clean up this session", "identify dirty files",
  "worktree cleanup", "what's safe to delete", "cleanup plan", "checkpoint the session", "session
  teardown", "which branches are mine vs other agents", or after a worktree/branch is deleted and
  you need to know what (if anything) was lost. It classifies every worktree/branch as CURRENT /
  PROTECT / SAFE-CANDIDATE, runs an orphan check on deleted branches, lists optional prune
  candidates, checkpoints session state CLOUD-DIRECT to CORTEX (Supabase cortex_* is the SSOT),
  and — when unfinished work is being handed to another agent — generates a self-contained 50x
  handoff via the handoff-framework — while strictly forbidding git reset / git rm / worktree
  remove. Especially important in multi-agent setups where several worktrees are live at once.
  Composes with git-hygiene (execution) and forecast-scrutiny (blast radius) if present.
---

# session-cleanup-checkpoint

Wind a session down safely. The failure mode this prevents: deleting a branch/worktree that
another (possibly still-active) agent owns, or assuming a deleted worktree lost work when it did
not. The discipline is **observe → classify → plan → checkpoint → handoff**, and the observation
is 100% read-only. Nothing here removes anything; a human or a confirm-gated git-hygiene step does
that.

## Why non-destructive is the whole point

In a multi-agent workspace, worktrees appear and vanish mid-session (a sibling agent finishes, a
harness prunes one). A `git reset`, `git branch -D`, or `git worktree remove` issued on a hunch can
silently regress another agent's feature or orphan unmerged commits. So this skill never mutates
git. It gives you the map; you (or git-hygiene) act on it deliberately.

## Workflow

### 1. Observe (read-only)
Run the forensics script against the repo:

```bash
npx tsx <this-skill>/scripts/forensics.mts --repo="$PWD" [--orphan=<deleted-branch>] [--json]
```

It reports: current branch + HEAD, **dirty files** (uncommitted — the only thing a teardown can
lose), stashes, every worktree with a verdict, an **orphan check** (does a deleted branch still
hold unmerged commits?), and optional prune candidates.

### 2. Classify (the verdicts)
- **CURRENT** — the worktree/branch this session is on. Never a cleanup target.
- **PROTECT** — unmerged commits, OR a worktree owned by another/active agent. **Off-limits.** In
  doubt, protect: a branch merged to main can still be actively in use in its worktree today.
- **SAFE-CANDIDATE** — merged to main AND no live worktree. Even these are **confirm-only**; list
  them, let the human choose. Never auto-delete.

### 3. Orphan check (did a deletion cost anything?)
For any branch/worktree that was deleted, run `--orphan=<branch>`. If it reports
`unmergedCommits=0` (or the branch is already gone with its work merged), nothing was lost —
say so plainly. If it has unmerged commits, surface them for recovery before anything else.

### 4. Checkpoint (persist state durably, CLOUD-DIRECT)
A session is not safely closed until its state is durable — this is the anti-data-loss lesson.
**CORTEX cloud (Supabase `cortex_*` tables) is the SSOT.** Checkpoint writes go **cloud-direct** to
`cortex_tasks` / `cortex_sessions`. The local `agent_kb.sqlite` is deprecated and ANVIL's
sqlite-first flow is legacy — do not treat a local sqlite write as a completed checkpoint (other
machines hydrate from the cloud, not from your disk).
- Ensure the transcript backup ran (a `cortex_session_backups` row exists for this session).
- Record open work as `cortex_tasks` rows in the cloud.
- Write the checkpoint straight to the cloud `cortex_tasks` row (checkpoint helper with cloud push
  enabled, or `execute_sql` against `cortex_tasks`). If the legacy ANVIL script is used, it must
  cloud-push — a local-only checkpoint does not count.
- **MALFIG VIO-0001 proof-gate:** never set `status=complete` on a `cortex_tasks` row whose
  `output_blob` lacks a proof trio — `pr`, `commit_sha`, and `verified_by`. No proof → status stays
  `in_progress`/`blocked`. This gate applies to the **cloud** row's `output_blob`.

### 5. Session-end handoff (if work is being reassigned)
A checkpoint persists *state*; a handoff makes *unfinished work resumable by someone else*.
Together they are the complete session-end contract — checkpoint alone leaves the next agent to
reverse-engineer intent from a task row. So whenever this session has unfinished work being handed
to another agent/session, generate a self-contained 50x handoff.

Use the **handoff-framework** MCP (root framework at `~/Downloads/.handoff-framework`, templates +
bin):
- Generate and write it: `mcp__handoff-framework__generate_handoff` with `write=true` (pass
  `session_id`, `title`, `what_shipped`, `open_items`, `next_steps`; the tool stamps git HEAD and
  writes to `docs/handoff/`).
- Validate it: `mcp__handoff-framework__validate_handoff` on the written path — it must pass
  (frontmatter + required sections) before the session is considered closed.
- `mcp__handoff-framework__list_templates` if you need to pick a template first.

Skip only when nothing is being reassigned (the session's work is fully merged/closed). If work is
outstanding but staying with you, still checkpoint — the handoff is specifically for cross-agent
resumability.

## Guardrails (do not violate)
- READ-ONLY forensics. Execution (if any) goes through **git-hygiene**, confirm-gated, and still
  never `reset` / `rm` / `worktree remove` on PROTECT items.
- Other agents' branches/worktrees are sacrosanct — a branch being merged is NOT permission to
  delete its live worktree.
- Verify the Stop-hook transcript backup before any teardown (see the problem-record-creation
  skill's guardrail — the missing precondition that caused prior data loss).
- CORTEX cloud (Supabase `cortex_*`) is the SSOT — checkpoint writes go **cloud-direct**; a
  local-only `agent_kb.sqlite` write is not a durable checkpoint. Enforce the VIO-0001 proof-gate
  (`pr` + `commit_sha` + `verified_by` in `output_blob`) on the **cloud** row before `complete`.
- Reassigning unfinished work is not done until a **validated** handoff exists — generate it via
  the handoff-framework MCP (`generate_handoff write=true` → `validate_handoff` must pass).

## Files
```
session-cleanup-checkpoint/
  SKILL.md
  scripts/forensics.mts   # read-only git/worktree forensics + verdicts + orphan check + prune candidates
```
