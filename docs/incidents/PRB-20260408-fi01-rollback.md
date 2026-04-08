# PRB-20260408: FI-01 Instruction Sync Rollback

**Date**: 2026-04-08
**Incident Commander**: @DaBigHomie
**Status**: Resolved (Rollback Complete)
**Successor**: FI-02 (Phased Remediation — In Planning)

---

## Incident Summary

FI-01 pushed 13 generic instruction files to 20 repositories simultaneously via automated PRs. All 20 PRs were rejected by AI code review agents due to architecture mismatches. A full rollback was executed using `git revert` (no history rewriting).

## Root Cause

1. **No per-repo segmentation**: Generic instructions applied uniformly across Vite, Next.js, Node CLI, Python, and metaframework repos
2. **No pre-flight validation**: No checks for repo compatibility before injecting files
3. **No phased rollout**: All 20 repos targeted simultaneously without canary validation
4. **Content quality issues**: TODO placeholders shipped where real data existed in package.json

## AI Review Failure Matrix

| Category | % of Issues | Affected Files |
|----------|-------------|---------------|
| Build/Script Mismatch | 41% | typescript.instructions.md |
| TODO Placeholders | 18% | testing-instructions.md |
| Missing Infrastructure | 16% | pr-review.instructions.md |
| Language/Extension Conflicts | 14% | core-directives.instructions.md |
| GitHub Actions/YAML Issues | 11% | workflow-syntax.instructions.md |

## Repos With Explicit AI Review Rejections

| Repo | Issues Found |
|------|-------------|
| copilot-chat-exporter | 5 (Python API + vscode:prepublish conflicts) |
| image-gen-30x-cli | 9 (build commands, agent references, extension rules) |
| haven-event-siteplan | 4 (static site vs SPA assumptions) |
| jay-anthony-app | 4 (framework detection failures) |
| tequila-sunrise-festival-atl | 5 (Vite vs Next.js paradigm clash) |

## Rollback Actions Taken

| Action | Count | Status |
|--------|-------|--------|
| Close open PR (#42 damieus_workflow_analysis) | 1 | ✅ |
| Delete FI-01 branches (local + remote) | 20 repos | ✅ |
| Revert inject commits (12 repos × 1 commit) | 12 | ✅ Pushed |
| Revert Management (2 commits) | 1 repo | ✅ Pushed |
| Revert ugwtf (3 commits: script, registry, prompts) | 1 repo | ✅ Pushed |
| copilot-chat-exporter | 1 repo | ⚠️ Local only (push blocked by repo rules) |

## What Was Reverted

- **12 repos**: `.github/copilot-instructions.md` + `AGENTS.md`
- **Management**: 4 instruction files + copilot-instructions + AGENTS.md
- **ugwtf**: `sync-instructions.py`, `WORKSPACE_AGENTS.md`, 15 repo registrations (21→6), 3 prompt files

## What Was Preserved

- All pre-existing instruction files in gold-standard repos
- Workspace-root `~/.github/instructions/` (14 files — canonical source)
- Full git history (revert commits preserve audit trail)

## Lessons Learned

1. **Architecture-aware content is mandatory** — no more generic file copies
2. **Canary deployment required** — single repo must pass before expanding blast radius
3. **Pre-flight validation script needed** — detect framework, existing configs, and conflicts before injection
4. **Instruction file taxonomy needed** — classify Universal vs Conditional vs Domain-Specific vs Repo-Unique

## FI-02 Plan

See `docs/incidents/FI-02-phased-remediation-plan.md` for the successor plan.
