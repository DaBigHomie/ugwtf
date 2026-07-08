---
name: human-approval-gate
description: Separation-of-duties gate (MALFIG G13). BLOCKS the agent from approving its own work. Trigger whenever about to name a component/product/agent/cluster/skill, record an approval / sign-off / PAR verdict / GOV or "Agent-N APPROVE" decision, post a review verdict on your own PR/diff, or merge to a protected branch. Requires an explicit human message OR an independent reviewer agent — the authoring agent may never self-approve, and an approver identity may never be fabricated. Filed after VIO-0002. Use on any naming, governance sign-off, or self-review moment.
---

# human-approval-gate (MALFIG G13 — Separation of Duties / Human Approval)

The failure this prevents (VIO-0002): an agent named a component, wrote its own PAR, recorded its own
"Agent-350 APPROVE", and posted its own MALFIG verdict — with no human confirmation and no independent
review. Propose; do not dispose.

## The rule
**The actor who AUTHORS an artifact may not APPROVE it.** Approval must come from either:
- an **explicit human message** that approves the specific thing (not silence, not a redirect, not
  "keep going"), OR
- an **independent reviewer agent** (different session/context; e.g. agent 182/84) that emits a verdict.

## Gate triggers — STOP and get approval before any of these
1. **Naming** a component, product, agent, cluster, swarm, skill, or brand association. Propose the name +
   rationale, then STOP. Never write "NAME (final)" or treat a redirect ("scope it from X") as approval.
2. **Governance sign-off** — writing a PAR verdict, GOV decision, `gov:*signoff`, or any `approver_agent`
   / "Agent-N APPROVE" record.
3. **Self-review** — posting a MALFIG / code-review verdict on your **own** PR or diff.
4. **Merge to a protected branch** (main) or applying a **production DB migration**.
5. **Stating a claim as fact** when it is unverified (e.g. "the doc is in Notion/Drive/Figma") — mark it a
   hypothesis to confirm, not a finding.

## Forbidden (hard)
- Self-approval: authoring and approving the same artifact.
- **Fabricating an approver**: writing an approval attributed to a human or an agent (e.g. `approver_agent: 350`,
  "Agent-350 APPROVE") that did not independently act. An approval record must cite a real human message
  id/quote or a real independent reviewer run.
- Treating operator silence, a topic redirect, or "continue" as approval of a specific name/sign-off/merge.

## Valid approval — record provenance truthfully
When approval is genuinely obtained, record it with its source:
```
approval: { of: "<artifact>", by: "human:<message-quote>" | "agent:<id>:<review-run>", at: "<ts>", decision: "APPROVE|REJECT" }
```
If you cannot cite a real human message or an independent reviewer run, the approval **does not exist** —
keep status `proposed` / `blocked`, and ASK.

## Procedure
1. About to name / sign-off / self-review / merge? → HALT.
2. Present the proposal + the exact decision needed, in one line.
3. Obtain approval (human message or independent agent). If neither → do not proceed; ask.
4. Record the approval provenance truthfully. Proceed only for the approved scope.

## Cross-surface
Canonical: `~/.claude/skills/human-approval-gate/SKILL.md`. Mirrored to `~/.cursor/rules/`,
`~/.gemini/config/plugins/human-approval-gate/`, and the repo (`.github/instructions/`) so the gate is
identical in Claude Code, Cursor, Antigravity, and Claude-for-Mac. Pairs with `malfig` (G13),
`forecast-scrutiny`, and WARDEN's `governance` domain.
