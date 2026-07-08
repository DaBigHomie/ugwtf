---
name: audit-script
description: Part of the Audit plugin. Audits a script's WORKFLOW / NAME / LOCATION / DETAILS against workspace parity + MALFIG/ANVIL governance, records a CORTEX task for findings, and enforces distribution via `prime-sync-skills.mts` (never ad-hoc cp). Use when adding/moving a script or skill, when one exists in more than one place, when asked "where should this live", or before copying skills across IDE surfaces. Triggers: "audit script", "script location", "workspace parity", "where should this live", "sync script".
---

# audit-script (Audit plugin)

Prevents the VIO-0002 root cause: hand-`cp`ing a script/skill into `~/Downloads` or an ad-hoc dir
instead of its governed home + sync path, bypassing Workspace Parity, MALFIG, and ANVIL logging.

## Reference docs (read before verdict)
- `maximus-ai/docs/WORKSPACE-CONFIGURATION-PARITY-SOLUTION.md` — the parity contract across IDE surfaces.
- `maximus-ai/docs/WORKSPACE-GIT-CORTEX-ARCHITECTURE.md` — where scripts/skills live vs CORTEX.
- `maximus-ai/CLAUDE.md` (MALFIG) — `.mts`-only, no orphaned `package.json`, CORTEX cloud-push (8b).
- `~/.claude/skills/human-approval-gate/SKILL.md` (G13) — never self-move without human approval.

## Audit dimensions (report each PASS/FIX with path evidence)
1. **Workflow** — which pipeline owns it (cortex / anvil / warden / malfig / skill-sync / deploy)? Is it
   invoked by a documented `npm run` / hook / skill, or orphaned?
2. **Name** — verb-noun, `.mts`/`.ts` only (MALFIG); matches repo convention; no `.sh`/`.js`.
3. **Location** — governed home vs actual:
   - Repo automation → `<repo>/scripts/*.mts`.
   - Skills → repo `.claude/skills` + `.gemini/skills` + `.cursor/rules`, then **distribute via**
     `npx tsx <repo>/scripts/prime-sync-skills.mts --push` — do NOT hand-copy. Flag `~/Downloads` /
     ad-hoc copies and cross-location duplicates (parity drift).
   - CLI/libs → root `.system/` or `packages/`.
4. **Details** — idempotent? logs its run? CORTEX cloud-push after seeds (MALFIG 8b)? portable paths
   (no hardcoded `/Users/...`)? `--dry-run` supported?

## Discoverability (attach so agents find the script)
A script is only "found" if it is reachable from an agent surface. Require ONE of:
`package.json` `scripts` entry (`npm run …`), a skill/plugin that invokes it, or a CORTEX
`ref:` knowledge row pointing at it. An orphaned `.mts` with no surface = FIX.

## Procedure
1. `git grep` / `ls` the script across the repo, `~/.claude|.gemini|.cursor`, `~/Downloads`, `~/scripts`.
2. Score each dimension; cite the exact `is -> should` path.
3. **Record a CORTEX task** for any FIX via `scripts/lib/cortex-write.mts` `cortexWriteTask`
   (local + cloud), `output_blob` naming the offending path + fix.
4. Emit the audit (no emoji). Do NOT move/delete without human approval (human-approval-gate / G13).

## Output
```
TASK-AUDIT-SCRIPT-XXXX — <script>
Workflow: PASS|FIX · Name: PASS|FIX · Location: PASS|FIX (is -> should) · Details: PASS|FIX · Discoverable: PASS|FIX
CORTEX task: <id>  Verdict: PASS | FIX (ordered actions)
```

## Pairs with
Audit plugin (`audit-fix-plan` / `audit-fix-ship`), `human-approval-gate`, `forecast-scrutiny`,
`git-hygiene`, and `prime-sync-skills.mts` (the governed distribution path).
