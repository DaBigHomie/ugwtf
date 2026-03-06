---
applyTo: "**"
---

# UGWTF Workflow Management

> Unified GitHub Workflow & Task Framework — handles labels, issues, PRs, CI/CD, and auditing for this repo.
> Package: `@dabighomie/ugwtf` v1.0.0 | Location: `~/management-git/ugwtf/`

---

## Quick Reference

This repo is registered as **`{{REPO_ALIAS}}`** in the UGWTF orchestrator.

```bash
# All commands run from the ugwtf directory
cd ~/management-git/ugwtf

# Run with npx tsx (dev) or ugwtf (if built)
npx tsx src/index.ts <command> [repos...] [flags]
```

---

## Commands

| Command | What It Does | When to Use |
|---------|-------------|-------------|
| `labels` | Sync universal + repo-specific labels | After adding new label definitions |
| `deploy` | Sync labels + deploy CI/CD workflow YAML files | Initial setup or workflow updates |
| `validate` | Run quality gates (tsc, lint, build, config) | Before commits, after major changes |
| `issues` | Detect stalled issues, assign Copilot, auto-triage | When issues pile up or need triage |
| `prs` | Review Copilot PRs, enforce DB migration firewall | When Copilot PRs need processing |
| `audit` | Full audit with scoreboard generation | Weekly health checks |
| `fix` | Auto-fix labels + workflows + quality issues | When audit reveals drift |
| `status` | Quick health snapshot | Anytime |

### Target This Repo Only

```bash
npx tsx src/index.ts issues {{REPO_ALIAS}}
npx tsx src/index.ts prs {{REPO_ALIAS}}
npx tsx src/index.ts audit {{REPO_ALIAS}} --verbose
npx tsx src/index.ts validate {{REPO_ALIAS}}
```

### Flags

```
--dry-run        Preview changes without executing
--verbose, -v    Show debug output
--concurrency N  Max parallel repos (default: 3)
--cluster ID     Run specific cluster (repeatable)
```

---

## Label System

### How to Label Issues

**Priority** (pick one):
- `priority:p0` — Critical, blocking launch
- `priority:p1` — High, needed before launch
- `priority:p2` — Medium, nice to have
- `priority:p3` — Low, future enhancement

**Automation tier** (pick one):
- `automation:copilot` — Copilot can implement autonomously
- `automation:full` — Fully automated workflow
- `automation:partial` — Agent assists, human decides
- `automation:manual` — Must be done manually

**Status** (applied automatically by agents):
- `automation:in-progress` — Pipeline running
- `automation:completed` — Done successfully
- `agent:copilot` — Assigned to Copilot
- `needs-pr` — Issue needs a pull request
- `stalled` — No activity >48h
- `needs-review` — Awaiting human review

**Category** (auto-triaged by keyword detection):
- `database`, `security`, `bug`, `enhancement`, `documentation`, `dependencies`, `infrastructure`

### Creating Issues for Copilot

To have Copilot auto-pick up an issue:

1. Create the issue with labels: `agent:copilot` + `automation:copilot` + `priority:pN`
2. Run: `npx tsx src/index.ts issues {{REPO_ALIAS}}`
3. The `issue-copilot-assign` agent will assign Copilot and mark `automation:in-progress`

---

## PR Workflow

### Copilot PR Pipeline

When Copilot creates a PR, the `prs` command handles:

1. **Detection** — Identifies Copilot PRs by label, author (`@copilot`), or branch prefix (`copilot/**`)
2. **DB Migration Firewall** — If PR touches `supabase/migrations/` or `.sql` files:
   - Blocks auto-merge
   - Posts manual intervention steps (apply SQL via Dashboard, regenerate types, run quality gates)
   - Applies `database` + `needs-review` labels
3. **Stale Draft Detection** — Flags abandoned draft PRs with `stalled` label
4. **Completion Tracking** — When a Copilot PR merges:
   - Finds linked issues (`Fixes #N`, `Closes #N`)
   - Applies `automation:completed` label
   - Removes `automation:in-progress` label

### Running PR Management

```bash
# Process all open Copilot PRs
npx tsx src/index.ts prs {{REPO_ALIAS}}

# Preview what would happen
npx tsx src/index.ts prs {{REPO_ALIAS}} --dry-run --verbose
```

---

## Issue Triage

The `issues` command runs 3 agents:

1. **Stalled Detector** — Finds `automation:in-progress` issues idle >48h → applies `stalled` + `needs-pr`
2. **Copilot Assign** — Finds `agent:copilot` issues not yet assigned → assigns Copilot + marks in-progress
3. **Auto-Triage** — Labels unlabeled issues by keyword:
   - `supabase|migration|database|schema|sql` → `database`
   - `bug|broken|crash|error|fix` → `bug`
   - `feature|enhancement|add|new|implement` → `enhancement`
   - `ci|cd|workflow|deploy|infra` → `infrastructure`
   - And more (security, docs, dependencies)

```bash
npx tsx src/index.ts issues {{REPO_ALIAS}}
```

---

## Quality Gates (via `validate`)

```bash
npx tsx src/index.ts validate {{REPO_ALIAS}}
```

Runs 4 checks:
1. **TypeScript** — `npx tsc --noEmit` (0 errors required)
2. **ESLint** — `npm run lint` (0 errors required)
3. **Build** — `npm run build` (must succeed)
4. **Config Health** — Checks for `tsconfig.json`, `package.json`, `.github/copilot-instructions.md`

---

## Audit & Scoreboard

```bash
npx tsx src/index.ts audit {{REPO_ALIAS}} --verbose
```

Generates a health score (0-100%) based on:
- Label coverage (all expected labels present)
- Workflow coverage (all CI/CD files deployed and not drifted)
- Quality gates (tsc, lint, build passing)
- Issue health (no stalled issues, proper labeling)

**Target: 80%+ to be considered stable.**

---

## DB Migration Firewall

When a Copilot PR contains database migrations, UGWTF blocks auto-merge and requires manual steps:

1. Apply migration SQL via **Supabase Dashboard → SQL Editor**
2. Regenerate types:
   ```bash
   npx supabase gen types typescript --project-id {{SUPABASE_PROJECT_ID}} > {{TYPES_OUTPUT_PATH}}
   ```
3. Deploy Edge Functions if needed
4. Run quality gates: `npx tsc --noEmit && npm run lint && npm run build`
5. Merge manually after verification

---

## Typical Agent Workflow

### New Feature → Issue → Copilot PR → Merge

```bash
# 1. Create issue on GitHub with labels:
#    agent:copilot + automation:copilot + priority:p1 + enhancement

# 2. Assign Copilot to the issue
npx tsx src/index.ts issues {{REPO_ALIAS}}

# 3. Wait for Copilot to create PR, then process it
npx tsx src/index.ts prs {{REPO_ALIAS}}

# 4. After merge, verify health
npx tsx src/index.ts audit {{REPO_ALIAS}}
```

### Weekly Maintenance

```bash
# Full stabilization pass
npx tsx src/index.ts deploy {{REPO_ALIAS}}       # Sync labels + workflows
npx tsx src/index.ts issues {{REPO_ALIAS}}       # Triage + stalled detection
npx tsx src/index.ts prs {{REPO_ALIAS}}          # Process Copilot PRs
npx tsx src/index.ts validate {{REPO_ALIAS}}     # Quality gates
npx tsx src/index.ts audit {{REPO_ALIAS}}        # Score + scoreboard
```

---

## Setup for New Repo

To add this instruction file to another repo:

1. Copy this template to `<repo>/.github/instructions/ugwtf-workflow.instructions.md`
2. Replace all `{{REPO_ALIAS}}` with the repo's alias from UGWTF (e.g., `damieus`, `ffs`, `maximus`, `cae`)
3. Replace `{{SUPABASE_PROJECT_ID}}` with the repo's Supabase project ID (or remove the DB section if N/A)
4. Replace `{{TYPES_OUTPUT_PATH}}` with the path to the generated types file
5. Add any repo-specific labels to the "Label System" section
