# UGWTF Pipeline Operations — Agent Runbook

> **Audience**: GitHub Copilot agents (VSCode + Cloud), CLI agents, human operators  
> **Last updated**: 2026-03-27  
> **Source of truth**: This file supersedes chain-instructions.md

---

## TL;DR — The Pipeline in 7 Commands

```bash
cd ~/management-git/ugwtf

# Setup — create spec issues + chain config
node dist/index.js prompts <alias> --no-cache --path <dir>
node dist/index.js generate-chain <alias> --no-cache --path <dir>

# Run — create chain issues, assign Copilot
node dist/index.js chain <alias> --no-cache

# Monitor — detect stalled work, verify PRs
node dist/index.js issues <alias> --no-cache
node dist/index.js prs <alias> --no-cache

# Recovery — reset broken state, validate e2e
node dist/index.js cleanup <alias> --no-cache
node dist/index.js dry-run <alias> --no-cache
```

**Prerequisite**: `export GITHUB_TOKEN=$(gh auth token)` — required for Copilot assignment.  
**Run from**: `node dist/index.js` (not `npx ugwtf`). Run `npm run build` first if source changed.

---

## Repo Aliases

| Alias | Repository | Framework |
|-------|-----------|-----------|
| `043` | DaBigHomie/one4three-co-next-app | Next.js |
| `ffs` | DaBigHomie/flipflops-sundays-reboot | Next.js |
| `damieus` | DaBigHomie/damieus-com-migration | Next.js |
| `maximus` | DaBigHomie/maximus-ai | Next.js |
| `cae` | DaBigHomie/Cae | Next.js |
| `ugwtf` | DaBigHomie/ugwtf | Node/TS library |

---

## Pipeline Flow

```
.prompt.md files
       │
       ▼
┌──────────────┐     Scans files, validates quality, creates GitHub issues
│  1. prompts  │──── Output: prompt-spec issues (#239, #240, etc.)
└──────┬───────┘     Labels: prompt-spec, agent:copilot, priority:*
       │
       ▼
┌──────────────────┐  Reads prompts, resolves dependencies, topological sort
│ 2. generate-chain│──── Output: scripts/prompt-chain.json (NO issues created)
└──────┬───────────┘
       │
       ▼
┌──────────────┐     Creates chain-tracker issues, assigns Copilot directly
│  3. chain    │──── Output: chain issues + Copilot assigned (via user PAT)
└──────┬───────┘     Labels: chain-tracker, agent:copilot, automation:in-progress
       │
       ▼
┌──────────────┐     Copilot creates PR → GHA: promote/validate/review/merge
│  GHA Phases  │──── 6 workflows handle PR lifecycle automatically
└──────┬───────┘     copilot-assign → pr-promote → pr-validate → pr-merged
       │
       ▼
┌──────────────┐     Chain-advance workflow dispatches chain-next
│  4. issues   │──── Detects stalled (>48h), re-assigns, auto-triages
└──────┬───────┘
       │
       ▼
┌──────────────┐     Reviews Copilot PRs, blocks unsafe DB migrations
│  5. prs      │──── Quality gates, auto-approve safe changes
└──────────────┘
```

### Recovery Pipeline

```
┌──────────────┐     Closes orphan PRs, strips labels, re-assigns Copilot
│  cleanup     │──── Resets chain to clean state after failures
└──────────────┘

┌──────────────┐     Validates config, workflows, issues, PRs, deps, assignment
│  dry-run     │──── E2E trace without changes — shows chain path visualization
└──────────────┘
```

---

## Issue Types — Two Layers

The pipeline creates **two issue types per prompt**:

### Layer 1: Prompt-Spec Issues (from `prompts` command)
- **Purpose**: Full implementation specification for the agent to follow
- **Contains**: Objective, success criteria, code examples, file manifest
- **Title format**: `fix(shop): fix major production bugs [SP-01]`
- **Labels**: `automation:copilot`, `agent:copilot`, `prompt-spec`, `needs-pr`, `priority:p0`
- **Created by**: `prompt-issue-creator` agent

### Layer 2: Chain-Tracker Issues (from `chain` command)
- **Purpose**: Sequencing and orchestration — controls execution order
- **Contains**: Position, wave, dependencies, severity, link to prompt file
- **Title format**: `fix(shop): fix major production bugs — chain 1/5 [CH-01]`
- **Labels**: `chain-tracker`, `agent:copilot`, `priority:*`
- **Created by**: `chain-issue-creator` agent
- **Copilot is assigned to THESE issues** (not spec issues)

### Why Two Layers?
- Spec issues are the **reference docs** — they persist even after the chain completes
- Chain issues are the **work tickets** — they get closed when the PR merges
- One prompt-spec may span multiple chain entries (or vice versa)

---

## Prompt File Format

Prompts live in `docs/prompts/` and MUST have YAML frontmatter:

```markdown
---
title: "P4A: Fix Major Production Bugs"
priority: p0
scope: bugfix
type: fix
wave: 1
dependencies: []
---

## Objective
Fix critical production bugs that block revenue...

## Success Criteria
- [ ] 500 errors eliminated on product pages
- [ ] Image loading optimized (WebP conversion)

## Tasks
1. Fix Stripe lazy initialization
2. Fix Supabase client guard
3. Convert JPG assets to WebP
```

### Required Frontmatter Fields
| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `title` | string | `"P4A: Fix Bugs"` | Issue title |
| `priority` | enum | `p0`, `p1`, `p2`, `p3` | Determines execution order |
| `scope` | string | `bugfix`, `feature`, `perf` | Categorization |
| `type` | string | `fix`, `feat`, `chore` | Git conventional commit type |
| `wave` | number | `1`, `2`, `3` | Parallel execution group |
| `dependencies` | array | `["P4A"]`, `[]` | Must complete before this starts |

---

## Flags Reference

| Flag | Effect | When to Use |
|------|--------|-------------|
| `--no-cache` | Skip repo-unchanged cache | **Always use after changes** |
| `--verbose` / `-v` | Show debug API calls | Debugging, first-time runs |
| `--dry-run` | Preview without changes | Before destructive operations |
| `--path <dir>` | Scope to specific folder | Target pending/ vs completed/ prompts |
| `--concurrency N` | Parallel repo limit | Rate limit control (default: 3) |
| `--output json` | Write JSON report | Machine-readable output |
| `--output markdown` | Write MD report | Human-readable reports |

---

## Audit Score Domains

`ugwtf status <alias>` checks 5 domains:

| Domain | 100% Means | Common Deductions |
|--------|-----------|-------------------|
| **Labels** | All universal labels exist | Missing label definitions |
| **Workflows** | Required CI files present | Missing ci.yml or automation workflow |
| **Issues** | No unlabeled, no unassigned | Orphaned issues, missing labels |
| **PRs** | No stale drafts, no unsafe merges | Abandoned PRs, unreviewed Copilot PRs |
| **Branches** | Clean branch structure | Stale feature branches, excess copilot/* |

### Scoring Rules
- `automation:in-progress` issues are NOT penalized (actively worked)
- `copilot/issue-NNN` branches are NOT penalized (expected for active chain)
- Target: **≥95%** per domain, **100%** overall

---

## Common Operations

### Start a New Chain from Scratch

```bash
# 1. Write .prompt.md files in docs/prompts/pending/
# 2. Create spec issues
node dist/index.js prompts 043 --no-cache --path docs/prompts/pending
# 3. Generate chain config
node dist/index.js generate-chain 043 --no-cache --path docs/prompts/pending
# 4. Review scripts/prompt-chain.json — fix waves/deps if needed
# 5. Create chain issues + start Copilot
node dist/index.js chain 043 --no-cache
```

### Reset a Stalled Chain

```bash
# Closes orphan PRs, strips automation labels, re-assigns Copilot
node dist/index.js cleanup 043 --no-cache --verbose
```

### Validate Chain Health (No Side Effects)

```bash
# E2E trace: config → workflows → issues → PRs → deps → assignment
node dist/index.js dry-run 043 --no-cache
# Shows: ✓=closed  ▶=in-progress  ◉=next  ○=waiting
```

### Check Chain Status
```bash
node dist/index.js chain 043 --no-cache --verbose
# Look for: "All chain entries resolved" or "Next: #NNN"
```

### Full Health Audit
```bash
node dist/index.js status 043 --no-cache --verbose
# Output: 5-domain score table + cross-repo scoreboard
```

---

## Troubleshooting

### Copilot not picking up issue
- **Cause**: `GITHUB_TOKEN` env var not set. Copilot coding agent requires a user PAT, not GHA's `GITHUB_TOKEN`.
- **Fix**: `export GITHUB_TOKEN=$(gh auth token)` then re-run `cleanup` or `chain`.
- **Verify**: Look for `[FETCH] Assigned Copilot` in verbose output (not `falling back to gh CLI`).

### Chain not advancing
- **Cause**: Previous chain issue still has `automation:in-progress`, or stale labels from failed run.
- **Fix**: `node dist/index.js cleanup 043 --no-cache --verbose`

### Copilot creates PR but chain doesn't advance
- **Cause**: PR merged but `copilot-pr-merged.yml` or `copilot-chain-advance.yml` didn't fire.
- **Fix**: Check GHA workflow runs. Re-run `chain` to force advancement.

### Cache prevents re-running
- **Cause**: UGWTF caches per-repo results to skip unchanged repos.
- **Fix**: Always use `--no-cache` flag.

### "Unknown repo alias" error
- **Cause**: Alias not in `src/config/repo-registry.ts`.
- **Fix**: Add repo config, rebuild (`npm run build`).

---

## Anti-Bypass Rules

> **⛔ ALL issue/PR/Copilot operations MUST go through UGWTF CLI.**

### Rule 1: No External Copilot Assignment
- ⛔ Never use `github-assign_copilot_to_issue` MCP tool
- ⛔ Never use `gh api` to assign Copilot directly
- ✅ Use `ugwtf chain <alias>` or `ugwtf cleanup <alias>`

### Rule 2: Copilot Assigned to CH Issues Only
- ⛔ Never assign Copilot to SP (spec) issues
- ✅ Chain-tracker issues are the work tickets

### Rule 3: No Manual Label/PR Edits
- ⛔ Never use `gh issue edit` or `gh pr edit` for chain operations
- ✅ Use `ugwtf cleanup` to reset labels, `ugwtf chain` to advance

### Rule 4: GITHUB_TOKEN Required
- The assignee name is `copilot-swe-agent[bot]` (NOT `copilot`)
- Requires `agent_assignment` payload with `target_repo` + `base_branch`
- GHA's `GITHUB_TOKEN` is NOT a user token — cannot start Copilot sessions
- `export GITHUB_TOKEN=$(gh auth token)` in shell profile

### Enforcement Checklist
- [ ] Using UGWTF CLI — NOT raw GitHub API or MCP tools
- [ ] Operating on CH (chain-tracker) issues — NOT SP issues
- [ ] `GITHUB_TOKEN` set in environment
- [ ] Pipeline order: `prompts` → `generate-chain` → `chain` → `issues` → `prs`

---

## GHA Workflow Files (PR Lifecycle)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `copilot-assign.yml` | `repository_dispatch: chain-next` | Remove old assignees, assign Copilot |
| `copilot-pr-promote.yml` | `pull_request: opened (draft)` | Draft → ready, request review |
| `copilot-pr-validate.yml` | `pull_request_review: submitted` | Validate, merge, firewall, retry |
| `copilot-pr-review.yml` | `pull_request_review: changes_requested` | Re-assign Copilot |
| `copilot-pr-merged.yml` | `pull_request: closed (merged)` | Close issues, dispatch chain-next |
| `copilot-chain-advance.yml` | `issues: closed` | Advance chain to next issue |

---

## File Locations

| File | Location | Purpose |
|------|----------|---------|
| UGWTF CLI | `~/management-git/ugwtf/` | Main tool |
| Compiled output | `~/management-git/ugwtf/dist/` | Run from here |
| Repo registry | `src/config/repo-registry.ts` | Alias → repo mapping |
| Agent definitions | `src/agents/*.ts` | All 94 agents |
| Chain config | `<repo>/scripts/prompt-chain.json` | Current chain state |
| Prompt files | `<repo>/docs/prompts/` | Source prompt specs |
| Audit cache | `.ugwtf/cache/` | Per-command caches |
| Reports | `.ugwtf/reports/` | Generated audit reports |
| Scoreboard | `.ugwtf/SCOREBOARD.json` | Cross-repo scores |
