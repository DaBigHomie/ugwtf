# UGWTF Pipeline Operations — Agent Runbook

> **Audience**: GitHub Copilot agents (VSCode + Cloud), CLI agents, human operators  
> **Last updated**: 2026-03-26  
> **Source of truth**: This file + `chain-instructions.md`

---

## TL;DR — The Pipeline in 5 Commands

> **⛔ CRITICAL RULE: Never skip steps. Run ALL 5 commands in order.**  
> Skipping `prompts` before `chain` results in missing spec issues.  
> Skipping `generate-chain` before `chain` results in no chain config.  
> Every step depends on the previous step's output.

```bash
cd ~/management-git/ugwtf

# Step 1: Create spec issues from .prompt.md files (REQUIRED FIRST)
node dist/index.js prompts <alias> --no-cache --path <dir>

# Step 2: Generate the execution chain config
node dist/index.js generate-chain <alias> --no-cache --path <dir>

# Step 3: Create chain-tracker issues + assign Copilot
node dist/index.js chain <alias> --no-cache

# Step 4: Monitor — detect stalled work, re-triage
node dist/index.js issues <alias> --no-cache

# Step 5: Audit — verify repo health score
node dist/index.js status <alias> --no-cache
```

**Important**: Always use `node dist/index.js` (not `npx ugwtf`) to get full output. Run `npm run build` first if source changed.

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

## Pipeline Flow (Detailed)

```
.prompt.md files
       │
       ▼
┌──────────────┐     Scans files, validates quality, creates GitHub issues
│  1. prompts  │──── Output: prompt-spec issues (#239, #240, etc.)
└──────┬───────┘     Labels: automation:copilot, agent:copilot, enhancement, priority:*
       │
       ▼
┌──────────────────┐  Reads prompts, resolves dependencies, topological sort
│ 2. generate-chain│──── Output: scripts/prompt-chain.json (NO issues created)
└──────┬───────────┘
       │
       ▼
┌──────────────┐     Creates chain-tracker issues, assigns Copilot to next
│  3. chain    │──── Output: chain issues (#234, #235, etc.) + Copilot assigned
└──────┬───────┘     Labels: automation:copilot, agent:copilot, automation:in-progress
       │
       ▼
┌──────────────┐     Copilot creates PR, merges, chain advances to next
│  4. issues   │──── Detects stalled (>48h), re-assigns, auto-triages
└──────┬───────┘
       │
       ▼
┌──────────────┐     Reviews Copilot PRs, blocks unsafe DB migrations
│  5. prs      │──── Quality gates, auto-approve safe changes
└──────────────┘
```

---

## Issue Types — Two Layers

The pipeline creates **two issue types per prompt**:

### Layer 1: Prompt-Spec Issues (from `prompts` command)
- **Purpose**: Full implementation specification for the agent to follow
- **Contains**: Objective, success criteria, code examples, file manifest
- **Title format**: `P0: 30X P4-A: Fix Major Production Bugs`
- **Labels**: `automation:copilot`, `agent:copilot`, `enhancement`, `priority:p0`
- **Created by**: `prompt-issue-creator` agent

### Layer 2: Chain-Tracker Issues (from `chain` command)
- **Purpose**: Sequencing and orchestration — controls execution order
- **Contains**: Position, wave, dependencies, severity, link to prompt file
- **Title format**: `[Chain 1/5] P4A: 01-P4A-fix-major-bugs`
- **Labels**: `automation:copilot`, `agent:copilot`, `enhancement`, `automation:in-progress`
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

> **⛔ Do NOT skip any step. Each step depends on the previous step's output.**

```bash
# 1. Write .prompt.md files in docs/prompts/pending/
# 2. REQUIRED: Create spec issues (must run BEFORE generate-chain)
node dist/index.js prompts 043 --no-cache --path docs/prompts/pending
# 3. Generate chain config
node dist/index.js generate-chain 043 --no-cache --path docs/prompts/pending
# 4. Review scripts/prompt-chain.json — fix waves/deps if needed
# 5. Create chain issues + start Copilot
node dist/index.js chain 043 --no-cache
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

### Fix Failing Audit Score
```bash
# Auto-fix labels and workflows
node dist/index.js fix 043 --no-cache
# Auto-triage issues (add labels, detect stalled)
node dist/index.js issues 043 --no-cache
# Clean stale branches manually:
gh api repos/DaBigHomie/one4three-co-next-app/branches --paginate -q '.[].name' | \
  grep -v "^main$" | grep -v "^copilot/issue-" | \
  xargs -I{} gh api -X DELETE "repos/DaBigHomie/one4three-co-next-app/git/refs/heads/{}"
```

### Deploy Labels + Workflows to a Repo
```bash
node dist/index.js install 043 --no-cache
# Alias: `deploy` does the same thing
```

---

## Troubleshooting

### UGWTF produces no output (just spinner)
- **Cause**: `npx ugwtf` wraps output in TTY spinner that gets swallowed
- **Fix**: Use `node dist/index.js` directly: `FORCE_COLOR=0 node dist/index.js status 043 --no-cache --verbose 2>&1 | cat`

### Cache prevents re-running
- **Cause**: UGWTF caches per-repo results to skip unchanged repos
- **Fix**: `--no-cache` flag OR delete `.ugwtf/cache/` directory

### "Unknown repo alias" error
- **Cause**: Alias not registered in `src/config/repo-registry.ts`
- **Fix**: Add repo config to registry, rebuild (`npm run build`)

### Chain not advancing
- **Cause**: Previous chain issue still open, or dependency not resolved
- **Fix**: Close resolved issues, then run `node dist/index.js chain 043 --no-cache`

### Copilot not picking up issue
- **Cause**: Assignment API requires specific transport (not `gh` CLI)
- **Fix**: Use `github-assign_copilot_to_issue` MCP tool, or assign via GitHub UI

### Prompt validation failing (<80%)
- **Cause**: Missing frontmatter fields or sections
- **Fix**: Add required fields per the format table above. Run with `--verbose` to see exact deductions.

---

## Agent Clusters (All 34)

<details>
<summary>Full cluster list with agent counts</summary>

| Cluster | Agents | Purpose |
|---------|--------|---------|
| `prompts` | 4 | Scan, validate, create issues, forecast |
| `generate-chain` | 1 | Build prompt-chain.json |
| `chain` | 3 | Load config, create issues, advance |
| `issues` | 3 | Stalled detection, Copilot assign, triage |
| `prs` | 3 | PR review, DB firewall, stale drafts |
| `labels` | 2 | Sync + audit label definitions |
| `audit` | 2 | Repo health + scoreboard |
| `fix` | 4 | Auto-fix labels, workflows, types, config |
| `design-system` | 3 | Token audit, component coverage |
| `performance` | 3 | Bundle, Lighthouse, image optimization |
| `security` | 3 | Dependency, secret, CSP audit |
| `a11y` | 2 | Accessibility scanning |
| `seo` | 2 | Meta tags, sitemap, structured data |
| `commerce` | 3 | Cart, checkout, product validation |
| ... | ... | (20 more domain clusters) |

</details>

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
