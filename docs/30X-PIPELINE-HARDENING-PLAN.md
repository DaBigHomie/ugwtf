# Plan: Harden & Deploy 30x Copilot Pipeline

> **Package**: `@dabighomie/ugwtf` v1.0.0  
> **Author**: DaBigHomie  
> **Generated**: March 11, 2026  
> **Status**: Pre-deployment hardening  
> **Document produced by**: Multi-cluster / multi-swarm forecasting analysis (4 parallel agents: Security & Permissions, Edge Cases & Failure Modes, Repo Config & Integration, CLI↔Workflow Integration)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The 30x Pipeline — 8-Phase Self-Healing Architecture](#2-the-30x-pipeline--8-phase-self-healing-architecture)
3. [Self-Healing Copilot Pipeline Deep Dive](#3-self-healing-copilot-pipeline-deep-dive)
4. [Node Module & Dependency Considerations](#4-node-module--dependency-considerations)
5. [Supabase Migration Firewall](#5-supabase-migration-firewall)
6. [Forecasting Agent Findings (35 Issues)](#6-forecasting-agent-findings-35-issues)
7. [Hardening Plan — 6 Phases (29 Action Items)](#7-hardening-plan--6-phases-29-action-items)
8. [Further Considerations (Resolved)](#8-further-considerations-resolved)
9. [Repo Configuration Matrix](#9-repo-configuration-matrix)
10. [CLI Agent Architecture](#10-cli-agent-architecture)
11. [Verification & Rollout](#11-verification--rollout)

---

## 1. Executive Summary

The UGWTF 30x Copilot Pipeline is an **8-phase, self-healing GitHub Actions workflow** that automates the entire lifecycle from issue creation through PR merge and issue chaining. It is generated dynamically per-repo by `copilot-automation.ts` and deployed via the UGWTF CLI (`npx tsx src/index.ts deploy`).

**Current state**: The pipeline compiles with 0 TypeScript errors and covers all 8 phases. Four forecasting agents identified **35 issues** (15 critical, 16 high, 5 medium, 2 low) across security, edge cases, repo config, and CLI integration domains.

**Goal**: Apply all critical hardening fixes, then deploy to 5 production repos (damieus, ffs, 043, maximus, cae).

### Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────────┐
│                    UGWTF 30x Copilot Pipeline                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────┐  │
│  │ Phase 1  │───▶│ Phase 2  │───▶│ Phase 3  │───▶│ Phase 5      │  │
│  │ Issue    │    │ Promote  │    │ Quality  │    │ Auto-Merge   │  │
│  │ Triage   │    │ Draft    │    │ Validate │    │ (non-DB)     │  │
│  └──────────┘    └──────────┘    └─────┬────┘    └──────────────┘  │
│                                        │                            │
│                                   ┌────┴────┐                      │
│                                   │ DB Migr?│                      │
│                                   └────┬────┘                      │
│                                   YES  │  NO                       │
│                               ┌────────┴────────┐                  │
│                               ▼                  ▼                  │
│                        ┌──────────┐       ┌──────────┐             │
│                        │ Phase 6  │       │ Phase 5  │             │
│                        │ DB Hold  │       │ Merge    │             │
│                        │ (manual) │       │ (auto)   │             │
│                        └──────────┘       └────┬─────┘             │
│                                                │                    │
│  ┌──────────┐    ┌──────────┐             ┌────▼─────┐             │
│  │ Phase 4  │◀───│ Review   │             │ Phase 8  │             │
│  │ Fix      │    │ Changes  │             │ Cleanup  │─────┐      │
│  │ Feedback │    │ Requested│             │ & Chain  │     │      │
│  └────┬─────┘    └──────────┘             └──────────┘     │      │
│       │                                                     │      │
│       ▼                                                     │      │
│  ┌──────────┐    ┌──────────┐                              │      │
│  │ Copilot  │    │ Phase 7  │                              │      │
│  │ Re-push  │───▶│ Failure  │◀──── (Phase 3 fail)          │      │
│  │ Commits  │    │ Handler  │                              │      │
│  └──────────┘    └────┬─────┘                              │      │
│                       │                                     │      │
│                       ▼                                     ▼      │
│                  Re-triggers Phase 3              Next Issue       │
│                  (self-healing loop)              (auto-chain)     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 30x Pipeline — 8-Phase Self-Healing Architecture

### 2.1 Pipeline Triggers

```yaml
on:
  issues:
    types: [opened, labeled]                    # Phase 1 entry point
  pull_request_target:
    types: [opened, synchronize, ready_for_review, closed]  # Phases 2, 3, 5, 6, 7, 8
    branches: [main, 'feature/**', 'copilot/**']
  pull_request_review:
    types: [submitted]                          # Phase 4 entry point
  workflow_dispatch:
    inputs:
      issue_number:
        description: 'Issue number to process'
        required: true
        type: number                            # Manual trigger
```

### 2.2 Concurrency Control

```yaml
concurrency:
  group: copilot-automation-${{ github.event.pull_request.number || github.event.issue.number || github.run_id }}
  cancel-in-progress: false
```

- **Group key**: Unique per PR or issue number — prevents parallel runs on the same work item
- **cancel-in-progress: false**: Critical — allows self-healing retry runs to complete rather than being killed by newer events

### 2.3 Phase-by-Phase Specification

---

#### PHASE 1: Issue Triage & Copilot Assignment

| Property | Value |
|----------|-------|
| **Job name** | `trigger-pr-creation` |
| **Trigger** | `issues.opened` or `issues.labeled` |
| **Guard condition** | Issue has label `automation:full`, `automation:copilot`, OR `agent:copilot` |
| **Permissions** | `issues: write`, `contents: write`, `pull-requests: write` |
| **Outputs** | `should_create_pr`, `issue_number` |

**Steps:**

1. **Check if PR already exists** — Searches all PRs (open + closed) for `Fixes #N`, `Closes #N`, or `Resolves #N` in body text. If found, skips creation.

2. **Assign Copilot coding agent** — Calls `github.rest.issues.addAssignees({ assignees: ['copilot'] })`. Posts an 8-phase pipeline activation comment. Adds `automation:in-progress` label.

3. **Create branch + placeholder draft PR (fallback)** — Creates `copilot/issue-{N}` branch from default branch HEAD. Opens a draft PR with body `Fixes #{N}`. Adds `automation:copilot` label to the PR.

**Copilot Agent Behavior**: Once assigned, the Copilot coding agent reads the issue, plans implementation, creates a working branch (or reuses the placeholder), and pushes implementation commits. This triggers Phase 2.

**Known limitation**: `assignees: ['copilot']` silently fails via the REST API in some configurations. The Copilot coding agent is still triggered by the issue label + comment mechanism. See [Section 8.1](#81-copilot-assignment-api) for workaround details.

---

#### PHASE 2: Promote Draft → Ready for Review

| Property | Value |
|----------|-------|
| **Job name** | `promote-and-review` |
| **Trigger** | `pull_request_target.synchronize` (when PR is still draft) |
| **Guard condition** | PR is draft AND has `automation:copilot` label OR branch starts with `copilot/` |
| **Permissions** | `contents: read`, `pull-requests: write`, `actions: write` |

**Steps:**

1. **Check if PR has real implementation** — Lists changed files via `pulls.listFiles()`. Requires at least one implementation file (`.ts`, `.tsx`, `.js`, `.jsx`, `.css`, `.json`, `.yml`, `.yaml`, `.md`, `.sql`).

2. **Convert draft to ready for review** — Calls `pulls.update({ draft: false })`. This transition triggers Phase 3.

3. **Request Copilot code review** — Calls `pulls.requestReviewers({ reviewers: ['copilot'] })`. The Copilot PR reviewer will analyze the code and may approve or request changes.

4. **Approve pending workflow runs** — Lists workflow runs with `status: 'action_required'`, filters by PR HEAD SHA, and approves each. This is required because `pull_request_target` workflows from forks/Copilot branches need explicit approval.

5. **Comment promotion status** — Posts a Phase 2 status table.

**Why `pull_request_target` instead of `pull_request`?**: Copilot coding agent pushes to branches that may not have workflow files. `pull_request_target` runs workflows from the target branch (main), ensuring the pipeline YAML is always available regardless of what Copilot pushes.

---

#### PHASE 3: Quality Validation

| Property | Value |
|----------|-------|
| **Job name** | `validate-pr` |
| **Trigger** | `pull_request_target.ready_for_review` or `pull_request_target.synchronize` (non-draft) |
| **Guard condition** | PR is NOT draft AND has `automation:copilot` or `automation:full` label OR branch starts with `copilot/` |
| **Permissions** | `contents: read`, `pull-requests: write` |
| **Outputs** | `all_checks_passed`, `has_db_migration`, `linked_issue` |

**Steps:**

1. **Checkout PR code** — Uses `actions/checkout@v4` with `ref: ${{ github.event.pull_request.head.sha }}`. Critical: checks out the PR HEAD, not the base branch.

2. **Detect DB migrations** — Scans changed files for:
   - Files in `supabase/migrations/` directory
   - Files ending in `.sql`
   
   If found, sets `has_db_migration=true` → routes to Phase 6 instead of Phase 5.

3. **Extract linked issue** — Parses PR body for `Fixes #N` / `Closes #N` / `Resolves #N` pattern. Stores issue number for Phase 7 re-assignment.

4. **Setup Node.js** — Uses `actions/setup-node@v4` with version from repo config (currently `20` for all repos). Enables npm cache.

5. **Install dependencies** — Runs `npm ci` to install from lockfile. See [Section 4](#4-node-module--dependency-considerations) for security hardening.

6. **Run TypeScript check** — `npx tsc --noEmit` with `continue-on-error: true`.

7. **Run ESLint** — `npm run lint` with `continue-on-error: true`.

8. **Run Build** — `npm run build` with `continue-on-error: true`.

9. **Determine overall status** — All three checks must succeed for `all_checks_passed=true`.

10. **Comment validation results** — Posts a results table with per-check pass/fail status and DB migration detection.

**Quality Gate Matrix per Framework:**

| Framework | TypeScript | ESLint | Build | Build Tool |
|-----------|-----------|--------|-------|------------|
| `vite-react` | `npx tsc --noEmit` | `npm run lint` | `npm run build` | Vite (esbuild) |
| `nextjs` | `npx tsc --noEmit` | `npm run lint` | `npm run build` | Next.js (webpack/turbopack) |

---

#### PHASE 4: Implement Review Feedback (Self-Healing Loop)

| Property | Value |
|----------|-------|
| **Job name** | `implement-review-feedback` |
| **Trigger** | `pull_request_review.submitted` with `state == 'changes_requested'` |
| **Guard condition** | PR has `automation:copilot` label OR branch starts with `copilot/` |
| **Permissions** | `pull-requests: write`, `issues: write`, `contents: read` |

**Steps:**

1. **Analyze review suggestions** — Lists review comments, filters by the submitted review ID, counts total comments and `\`\`\`suggestion` blocks.

2. **Extract linked issue** — Same `Fixes #N` parsing as Phase 3.

3. **Re-assign Copilot to implement fixes** — Assigns Copilot to the linked issue (if found). The Copilot coding agent will read the review comments, understand the requested changes, and push new commits.

4. **Comment feedback status** — Posts a Phase 4 status with comment/suggestion counts.

**Self-Healing Flow:**
```
Review submitted (changes_requested)
    → Phase 4: Re-assign Copilot
        → Copilot reads review comments
            → Copilot pushes fix commits
                → Phase 3 re-triggers (PR synchronize)
                    → Quality checks pass → Phase 5 (merge)
                    → Quality checks fail → Phase 7 (retry)
```

---

#### PHASE 5: Auto-Approve & Merge

| Property | Value |
|----------|-------|
| **Job name** | `auto-merge` |
| **Trigger** | Depends on `validate-pr` (Phase 3) |
| **Guard condition** | `all_checks_passed == 'true'` AND `has_db_migration == 'false'` |
| **Permissions** | `contents: write`, `pull-requests: write`, `issues: write` |

**Steps:**

1. **Auto-approve PR** — Uses `hmarr/auto-approve-action@v4` with `GITHUB_TOKEN`.

2. **Enable auto-merge** — Runs `gh pr merge --auto --squash "$PR_NUMBER"`. The `--auto` flag means GitHub will merge once all branch protection requirements are satisfied.

3. **Comment merge status** — Posts Phase 5 completion.

**Prerequisites for success:**
- Repository must have "Allow auto-merge" enabled in Settings → General
- Branch protection rules must be satisfied (required status checks, required reviews)
- `GITHUB_TOKEN` must have `contents: write` permission

**Merge strategy**: Squash — all Copilot commits are squashed into a single commit on the default branch.

---

#### PHASE 6: DB Migration Firewall

| Property | Value |
|----------|-------|
| **Job name** | `db-migration-hold` |
| **Trigger** | Depends on `validate-pr` (Phase 3) |
| **Guard condition** | `all_checks_passed == 'true'` AND `has_db_migration == 'true'` |
| **Permissions** | `pull-requests: write`, `issues: write` |

**Why this phase exists**: Supabase database migrations **cannot** be applied by the Copilot coding agent. The agent:
1. Cannot run `npx supabase db push` (direct DB connection blocked in CI)
2. Cannot run `scripts/apply-migration-via-rest.cjs` (requires `SUPABASE_SERVICE_ROLE_KEY`)
3. Cannot regenerate types (`npx supabase gen types` requires auth)

**Steps:**

1. **Post manual merge instructions** — Customized per repo based on `supabaseProjectId` and `supabaseTypesPath`:

   **For repos WITH Supabase** (damieus, ffs, 043, maximus):
   ```
   1. Apply migration SQL via Supabase Dashboard → SQL Editor
   2. Regenerate types: npx supabase gen types typescript --project-id {ID} > {path}
   3. Deploy Edge Functions if needed
   4. Run quality gates: npx tsc --noEmit && npm run lint && npm run build
   5. Merge PR manually after verification
   ```
   
   **For repos WITHOUT Supabase** (cae):
   ```
   1. Review migration SQL carefully
   2. Apply migration manually
   3. Run quality gates: npx tsc --noEmit && npm run lint && npm run build
   4. Merge PR manually after verification
   ```

2. **Apply labels** — Adds `database` and `needs-review` labels to the PR.

**Supabase Migration Safety Matrix:**

| Repo | Project ID | Types Path | Edge Functions |
|------|-----------|-----------|----------------|
| damieus | `okonslamwxtcoekuhmtm` | `src/integrations/supabase/types.ts` | Yes |
| ffs | `tyeusfguqqznvxgloobb` | `src/integrations/supabase/types.ts` | Yes |
| 043 | `bgqjgpvzokonkyiljasj` | `src/lib/supabase/types.ts` | Planned |
| maximus | `ycqtigpjjiqhkdecwiqt` | `src/shared/types/database.ts` | Yes |
| cae | N/A | N/A | N/A |

---

#### PHASE 7: Failure Handling & Auto-Retry (Self-Healing)

| Property | Value |
|----------|-------|
| **Job name** | `handle-failure` |
| **Trigger** | Depends on `validate-pr` (Phase 3) |
| **Guard condition** | `all_checks_passed == 'false'` |
| **Permissions** | `pull-requests: write`, `issues: write` |

**Steps:**

1. **Extract linked issue** — Uses `linked_issue` output from Phase 3.

2. **Re-assign Copilot to fix failures** — Assigns Copilot to the linked issue so the coding agent can analyze the TypeScript/ESLint/Build errors and push fix commits.

3. **Add `needs-review` label** — Flags the PR for human attention if self-healing fails.

4. **Comment failure status** — Posts Phase 7 self-healing activation message with next-steps explanation.

**Self-Healing Flow:**
```
Phase 3: Quality checks FAIL
    → Phase 7: Re-assign Copilot to linked issue
        → Copilot analyzes error logs
            → Copilot pushes fix commits
                → Phase 3 re-triggers (PR synchronize)
                    → Pass → Phase 5 (merge)
                    → Fail again → Phase 7 (retry, up to MAX_ATTEMPTS)
```

**Hardening required**: Currently no max retry counter — could loop infinitely. See [Section 7, Phase B, Item 7](#phase-b-harden-pipeline-copilot-automationts).

---

#### PHASE 8: Post-Merge Cleanup & Issue Chain

| Property | Value |
|----------|-------|
| **Job name** | `post-merge-cleanup` |
| **Trigger** | `pull_request_target.closed` with `merged == true` |
| **Guard condition** | PR has `automation:copilot` label OR branch starts with `copilot/` |
| **Permissions** | `issues: write`, `contents: read` |

**Steps:**

1. **Extract linked issues** — Uses `matchAll(/(?:Fixes|Closes|Resolves)\s+#(\d+)/gi)` to find ALL linked issues (supports multiple).

2. **Update completed issues** — For each linked issue:
   - Add `automation:completed` label
   - Remove `automation:in-progress` label (with `.catch(() => {})` for graceful failure)
   - Close issue with `state_reason: 'completed'`

3. **Find next queued issue** — Searches for open issues with BOTH `agent:copilot` AND `automation:copilot` labels, sorted by creation date (oldest first). Filters out issues that already have `automation:in-progress` label.

4. **Chain to next issue** — Assigns Copilot to the next issue and adds `automation:in-progress` label. This starts Phase 1 for the next work item.

5. **Comment completion** — Posts Phase 8 summary with completed issues and chain target.

**Auto-Chain Behavior:**
```
PR merged
    → Phase 8: Close completed issues
        → Find next open issue with agent:copilot + automation:copilot
            → Assign Copilot + add automation:in-progress
                → Phase 1 triggers (issue labeled)
                    → Full pipeline begins for next issue
```

This creates a **continuous execution loop** where Copilot processes issues one-by-one in FIFO order until no more queued issues remain.

---

## 3. Self-Healing Copilot Pipeline Deep Dive

### 3.1 Three Self-Healing Mechanisms

The pipeline implements three distinct self-healing loops:

#### Loop 1: Quality Failure Recovery (Phase 7 → Phase 3)

```
                    ┌───────────────────────────┐
                    │                           │
                    ▼                           │
              ┌──────────┐                ┌──────────┐
              │ Phase 3  │──── FAIL ────▶│ Phase 7  │
              │ Quality  │                │ Re-assign│
              │ Checks   │                │ Copilot  │
              └────┬─────┘                └──────────┘
                   │                           │
                  PASS                    Copilot pushes
                   │                     fix commits
                   ▼                           │
              ┌──────────┐                     │
              │ Phase 5  │                     │
              │ Merge    │◀────────────────────┘
              └──────────┘         (new synchronize event
                                    re-triggers Phase 3)
```

**What Copilot sees**: The Phase 7 comment tells Copilot to "analyze the TypeScript / ESLint / Build errors" and push fix commits. Copilot reads the error output from the Phase 3 comment and understands what failed.

**Failure modes**: 
- TypeScript errors from incompatible types
- ESLint violations from code style issues
- Build failures from missing imports, environment variables, or configuration

#### Loop 2: Review Feedback Implementation (Phase 4 → Phase 3)

```
              ┌──────────┐
              │ Phase 3  │
              │ Quality  │◀─────────────────────┐
              │ Checks   │                      │
              └────┬─────┘                      │
                   │                       Copilot pushes
                  PASS                     review fixes
                   │                            │
                   ▼                            │
              ┌──────────┐               ┌──────────┐
              │ Copilot  │──── changes ─▶│ Phase 4  │
              │ PR       │    requested  │ Feedback │
              │ Review   │               │ Loop     │
              └──────────┘               └──────────┘
```

**What triggers this**: The Copilot PR reviewer (not the coding agent) analyzes the diff and may request changes. Phase 4 then re-assigns the Copilot *coding* agent to implement those changes.

#### Loop 3: Issue Chain (Phase 8 → Phase 1)

```
    Issue #1         Issue #2         Issue #3
    ┌──────┐        ┌──────┐        ┌──────┐
    │Phase1│──...──▶│Phase8│        │      │
    │ → 8  │        │Chain │───────▶│Phase1│──...──▶ Phase 8 → Chain → ...
    └──────┘        └──────┘        └──────┘
```

**Queue processing**: Issues are processed in FIFO order (oldest first). The chain continues until no open issues with `agent:copilot` + `automation:copilot` labels remain.

### 3.2 Concurrency Safety

```yaml
concurrency:
  group: copilot-automation-${{ github.event.pull_request.number || github.event.issue.number || github.run_id }}
  cancel-in-progress: false
```

**Why `cancel-in-progress: false`**: The self-healing loops create new workflow runs when Copilot pushes fix commits. If `cancel-in-progress` were `true`, the new run would kill the in-progress Phase 7/Phase 4 job before it completes posting its comment.

**Group key composition**:
- PR events: grouped by PR number (phases 2-8 share the same group per PR)
- Issue events: grouped by issue number (Phase 1 isolated per issue)
- Fallback: `github.run_id` for workflow_dispatch or edge cases

### 3.3 Event Flow Diagram

```
USER creates issue                                COPILOT coding agent
with label agent:copilot                          (external to GitHub Actions)
        │                                                    │
        ▼                                                    │
┌── Phase 1 ──┐                                             │
│ Issue Triage │ ──── assign Copilot ────────────────────────▶│
│ Create branch│                                             │
│ Draft PR     │                                             │
└──────────────┘                                             │
                                                             │
                         ◀──── Copilot pushes commits ───────┘
                         │                                   │
┌── Phase 2 ──┐          │                                   │
│ Promote draft│◀─────────                                   │
│ Request review│                                            │
│ Approve runs │                                             │
└──────┬───────┘                                             │
       │                                                     │
       ▼                                                     │
┌── Phase 3 ──┐                                             │
│ tsc + lint   │                                             │
│ + build      │                                             │
│ + DB detect  │                                             │
└──────┬───────┘                                             │
       │                                                     │
    ┌──┴──┐                                                  │
   PASS  FAIL                                                │
    │      │                                                 │
    │   ┌──▼──────┐                                          │
    │   │Phase 7  │ ──── re-assign Copilot ─────────────────▶│
    │   │Retry    │                                          │
    │   └─────────┘         ◀── Copilot pushes fixes ────────┘
    │                       │
    │                  Back to Phase 3
    │
    ├── has DB? ──▶ Phase 6 (manual merge)
    │
    └── no DB ──▶ Phase 5 (auto-merge)
                      │
                      ▼
                ┌── Phase 8 ──┐
                │ Close issues │
                │ Chain next   │──── assign Copilot ─────────▶ (next issue)
                └──────────────┘
```

---

## 4. Node Module & Dependency Considerations

### 4.1 Supply Chain Attack Vector (CRITICAL)

The current pipeline uses `npm ci` in Phase 3 to install dependencies. This runs **preinstall** and **postinstall** scripts from `package.json`, which creates a supply chain attack vector:

**Attack scenario with `pull_request_target`:**
1. Attacker forks repo and modifies `package.json` to add a malicious `preinstall` script
2. Opens a PR targeting the default branch
3. Phase 3 triggers on `pull_request_target` (runs with **base branch** workflow but checks out **PR HEAD** code)
4. `npm ci` runs the attacker's `preinstall` script with access to `GITHUB_TOKEN`

**Mitigation (P0 — must implement before deploy):**

```yaml
# BEFORE (vulnerable):
- name: Install dependencies
  run: npm ci

# AFTER (hardened):
- name: Install dependencies (no lifecycle scripts)
  run: npm ci --ignore-scripts

- name: Rebuild native modules (if needed)
  run: npm rebuild
  continue-on-error: true
```

The `--ignore-scripts` flag prevents execution of `preinstall`, `postinstall`, and `prepare` scripts. The subsequent `npm rebuild` step handles native module compilation (e.g., `esbuild`, `sharp`, `@parcel/watcher`) that relies on postinstall scripts.

### 4.2 Node Version Management

All 5 repos use Node.js 20 (LTS). The pipeline reads `nodeVersion` from repo config:

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
```

**npm cache**: Enabled via `cache: 'npm'` — caches `~/.npm` between runs, reducing install time by 40-60%.

### 4.3 Dependency Lock File Integrity

`npm ci` (vs `npm install`) provides:
- Installs exactly from `package-lock.json` — no resolution drift
- Fails if `package-lock.json` is out of sync with `package.json`
- Deletes `node_modules/` before installing — clean state guaranteed

**Framework-specific `node_modules` sizes:**

| Repo | Framework | Approx `node_modules` size | Key heavy deps |
|------|-----------|---------------------------|----------------|
| damieus | vite-react | ~400MB | vite, esbuild, tailwindcss, shadcn/ui |
| ffs | vite-react | ~400MB | vite, esbuild, tailwindcss, zustand |
| 043 | nextjs | ~600MB | next, react, tailwindcss, stripe |
| maximus | nextjs | ~700MB | next, stripe, resend, supabase-js |
| cae | vite-react | ~350MB | vite, esbuild, tailwindcss |

### 4.4 Build Timeout Considerations

**Current state**: No `timeout-minutes` set on build steps. Large Next.js builds (maximus, 043) can take 5-10 minutes depending on runner load.

**Recommended timeouts:**

| Step | Timeout | Rationale |
|------|---------|-----------|
| `npm ci --ignore-scripts` | 10 minutes | Large lockfiles + cold cache |
| `npm rebuild` | 5 minutes | Native module compilation |
| `npx tsc --noEmit` | 10 minutes | Large codebases (maximus: 700+ files) |
| `npm run lint` | 5 minutes | ESLint traverses all src files |
| `npm run build` | 15 minutes | Next.js full build + optimization |

### 4.5 Transitive Dependency Risks

The pipeline installs ALL dependencies (including `devDependencies`) because `npm ci` respects the full lockfile. This means:

- **`sharp`** (image optimization in Next.js): Requires native binaries, may fail on arm64 runners
- **`esbuild`**: Uses platform-specific binaries installed via postinstall
- **`@swc/core`**: Used by Next.js for fast compilation, has platform-specific packages
- **`playwright`**: Only needed for E2E (currently skipped in Phase 3 for speed)

**With `--ignore-scripts`**, these postinstall-dependent packages may need `npm rebuild`:
```bash
npm rebuild esbuild sharp @swc/core 2>/dev/null || true
```

---

## 5. Supabase Migration Firewall

### 5.1 Why Auto-Merge is Blocked for DB Migrations

Database migrations are **irreversible operations** that can:
- Drop tables or columns with production data
- Alter RLS (Row Level Security) policies affecting access control
- Create functions or triggers that change business logic
- Require coordinated Edge Function deployment

The Copilot coding agent **cannot**:
1. Access Supabase Dashboard to apply SQL
2. Run `npx supabase db push` (blocked by CI network restrictions)
3. Execute the REST API migration script (requires `SUPABASE_SERVICE_ROLE_KEY` which shouldn't be exposed in CI)
4. Verify the migration worked against live data

### 5.2 Migration Detection Logic

```typescript
const hasDB = files.some(f =>
  f.filename.includes('supabase/migrations') ||
  f.filename.endsWith('.sql')
);
```

This catches:
- New migration files: `supabase/migrations/20260311000000_add_feature.sql`
- Modified existing migrations (dangerous — should be flagged separately)
- SQL files anywhere in the repo (Edge Function SQL, seed files, etc.)

**Enhancement opportunity**: Distinguish between `supabase/migrations/*.sql` (schema changes) and other `.sql` files (seeds, Edge Functions, queries), which could safely auto-merge.

### 5.3 Manual Merge Workflow

When Phase 6 fires, the PR comment provides repo-specific instructions:

**Example for `damieus` (Supabase project: `okonslamwxtcoekuhmtm`):**

```
## Phase 6: DB Migration Firewall — Manual Merge Required

Quality checks passed but this PR contains database migrations.
Auto-merge is disabled for safety.

Manual steps required:
1. Apply migration SQL via Supabase Dashboard → SQL Editor
2. Regenerate types: `npx supabase gen types typescript --project-id okonslamwxtcoekuhmtm > src/integrations/supabase/types.ts`
3. Deploy Edge Functions if needed
4. Run quality gates: `npx tsc --noEmit && npm run lint && npm run build`
5. Merge PR manually after verification
```

### 5.4 Migration Safety Labels

The pipeline applies two labels on DB migration PRs:
- `database` — Category marker
- `needs-review` — Blocks auto-merge, signals human attention needed

Additionally, the universal label set includes:
- `safe-migration` — Applied after DBA review confirms safety
- `destructive-migration` — Applied if migration contains `DROP`, `TRUNCATE`, `DELETE`, or `ALTER TABLE ... DROP COLUMN`
- `types-update` — Applied when only `types.ts` is regenerated (safe to auto-merge)

### 5.5 Supabase Secret Requirements

Each repo with Supabase needs these GitHub Secrets configured:

| Secret Name | Example (damieus) | Used By |
|-------------|-------------------|---------|
| `SUPABASE_URL_{ALIAS}` | `SUPABASE_URL_DAMIEUS` | Edge Function deployment, type regeneration |
| `SUPABASE_SERVICE_ROLE_KEY_{ALIAS}` | `SUPABASE_SERVICE_ROLE_KEY_DAMIEUS` | REST API migration script, admin operations |

**Verification command:**
```bash
gh secret list --repo DaBigHomie/damieus-com-migration
```

---

## 6. Forecasting Agent Findings (35 Issues)

Four parallel forecasting agents analyzed the pipeline for blind spots. Combined findings below, sorted by severity:

### 6.1 Summary by Domain

| Agent | Domain | CRIT | HIGH | MED | LOW | Total |
|-------|--------|------|------|-----|-----|-------|
| Agent 1 | Security & Permissions | 3 | 4 | 3 | 2 | 12 |
| Agent 2 | Edge Cases & Failure Modes | 5 | 6 | 0 | 0 | 11 |
| Agent 3 | Repo Config & Integration | 4 | 3 | 1 | 0 | 8 |
| Agent 4 | CLI↔Workflow Integration | 3 | 3 | 1 | 0 | 7† |
| | **TOTAL** | **15** | **16** | **5** | **2** | **38†** |

† Agent 4 had 1 finding marked RESOLVED (prompt-to-issue labeling works correctly). Net actionable: 35.

### 6.2 All Critical Findings

| ID | Domain | Finding | Risk | Fix |
|----|--------|---------|------|-----|
| S-1 | Security | `npm ci` runs attacker's `preinstall` script via `pull_request_target` | Supply chain attack — GITHUB_TOKEN exposure | Add `--ignore-scripts` + `npm rebuild` |
| S-2 | Security | Issue title injected unsanitized into PR title | Markdown injection, potential command injection | Strip `\`${}|<>\[\]` from title |
| S-3 | Security | Race condition — concurrent issue events create duplicate PRs | Resource waste, confusing state | Branch-exists idempotency + cancel-in-progress |
| E-1 | Edge | Infinite retry loop Phase 7→3→7 with no max attempts | Unbounded CI costs, runner exhaustion | Counter in PR body, max 3 attempts |
| E-2 | Edge | Every retry creates NEW comment (no dedup) | Comment spam floods PR | Find/update existing bot comment by phase marker |
| E-3 | Edge | Concurrent Phase 8 double-assigns next issue | Two pipelines on same issue, conflict | Dedicated concurrency group for chain |
| E-4 | Edge | PR link parsing misses Copilot PRs without `Fixes #N` | Orphaned issues never close | Also check branch name `copilot/issue-{N}` |
| E-5 | Edge | `workflow_dispatch` input completely unused | Dead code | Implement Phase 0 manual trigger or remove |
| R-1 | Repo | Damieus `enforce-pr-creation.yml` conflicts with Phase 1 | Double PR creation, label conflicts | Delete conflicting workflow |
| R-2 | Repo | Auto-merge silently fails without "Allow auto-merge" setting | Phase 5 does nothing | Enable in all 5 repos |
| R-3 | Repo | FFS on worktree branch, not main | Pipeline generates `main` branch targets but FFS is on `copilot-worktree-*` | Merge FFS to main, or update registry |
| R-4 | Repo | Supabase secrets not verified in any repo | Phase 6 instructions reference secrets that may not exist | `gh secret list` per repo |
| C-1 | CLI | `prCompletionTracker` duplicates Phase 8 | Race condition — CLI + workflow both update issues | Deprecate CLI agent |
| C-2 | CLI | `prReviewAgent` duplicates Phases 3/6 | Comment spam — double DB migration warnings | Deprecate CLI agent |
| C-3 | CLI | `copilotAssignAgent` duplicates Phase 1 | Guarded by checks — safe as fallback | Keep, document primacy |

### 6.3 All High Findings

| ID | Domain | Finding | Fix |
|----|--------|---------|-----|
| S-4 | Security | Copilot assignment silently fails (`assignees: ['copilot']`) | Document limitation, rely on label trigger |
| S-5 | Security | Markdown injection in Phase 8 chain comment (`nextIssue.title`) | Escape markdown special chars |
| S-6 | Security | Supabase secrets exposed in curl logs (migration workflow) | Add `::add-mask::` before any secret usage |
| S-7 | Security | Transitive dependency risk from full `npm ci` install | Consider `--production` for runtime-only |
| E-6 | Edge | Inconsistent label detection across phases (some check `automation:copilot`, others don't) | Normalize to always check both `automation:copilot` AND `automation:full` |
| E-7 | Edge | Inconsistent PR body parsing (`match` in Phase 3, `matchAll` in Phase 8) | Unify to `matchAll` everywhere |
| E-8 | Edge | Phase 2 fails on non-draft PRs from Copilot | Expand trigger to include `opened` + `ready_for_review` |
| E-9 | Edge | Phase 1 pagination only checks first 30 PRs | Add `per_page: 100` + pagination loop |
| E-10 | Edge | Label removal race condition in Phase 8 | Already has `.catch(() => {})` — acceptable |
| E-11 | Edge | Empty commit handling (Copilot pushes empty commit) | Check commit diff count before promoting |
| R-5 | Repo | E2E tests skipped in pipeline (intentional) but maximus registry wrong | Fix `hasE2E: true` for maximus |
| R-6 | Repo | 043 test selection unclear | Document `npm run test:e2e` command |
| C-4 | CLI | `stalledIssueDetector` checks PR existence but not commit count | Enhancement: check PR has commits + not stale draft |
| C-5 | CLI | Deploy command doesn't run triage after deployment | Add optional post-deploy triage |
| C-6 | CLI | Audit missing phase-coverage scoring domain | Add check: all 8 jobs exist in deployed YAML |

### 6.4 Medium & Low Findings

| ID | Severity | Finding | Fix |
|----|----------|---------|-----|
| S-8 | MED | Over-permissioning in auto-approve (uses GITHUB_TOKEN for approve + merge) | Split into separate job permissions |
| S-9 | MED | No audit logging for auto-approve/merge actions | Add structured logging to issue comments |
| S-10 | MED | Missing `workflow_dispatch` input validation | Validate issue number exists and has correct labels |
| C-7 | MED | Dry-run mode is shallow (just skips API calls) | Add simulated output for testing |
| S-11 | LOW | Incomplete error handling in Phase 2 workflow approval | Already has try/catch — acceptable |
| S-12 | LOW | No timeout-minutes on npm steps | Add 10/15 min timeouts |

---

## 7. Hardening Plan — 6 Phases (29 Action Items)

### Phase A: UGWTF Package (COMPLETED)

| # | Item | Status |
|---|------|--------|
| 1 | Rewrote `copilot-automation.ts` — 5-phase → 8-phase 30x pipeline | ✅ Done |
| 2 | TypeScript: 0 errors | ✅ Done |
| 3 | 4 forecasting agents completed | ✅ Done |

### Phase B: Harden Pipeline (`copilot-automation.ts`)

**P0 — Must fix before deploy:**

| # | Fix | Severity | File | Section |
|---|-----|----------|------|---------|
| 4 | Add `--ignore-scripts` to `npm ci` in Phase 3 | CRITICAL | copilot-automation.ts | Phase 3 install step |
| 5 | Sanitize issue title before PR title in Phase 1 | CRITICAL | copilot-automation.ts | Phase 1 PR creation step |
| 6 | Add branch-exists idempotency in Phase 1 | CRITICAL | copilot-automation.ts | Phase 1 branch creation step |
| 7 | Add max retry counter (3 attempts) in Phase 7 | CRITICAL | copilot-automation.ts | Phase 7 re-assign step |
| 8 | Comment deduplication — find/update existing bot comments | CRITICAL | copilot-automation.ts | All comment steps |
| 9 | Add pagination (`per_page: 100`) to Phase 1 PR check | HIGH | copilot-automation.ts | Phase 1 check step |
| 10 | Expand Phase 2 triggers for non-draft Copilot PRs | HIGH | copilot-automation.ts | Phase 2 if condition |
| 11 | Normalize label detection across all phases | HIGH | copilot-automation.ts | All phase if conditions |
| 12 | Unify PR body parsing to `matchAll` | HIGH | copilot-automation.ts | Phases 3, 4 |
| 13 | Phase 8 concurrency group for chain safety | CRITICAL | copilot-automation.ts | Phase 8 job |
| 14 | Escape markdown in Phase 8 chain comment | HIGH | copilot-automation.ts | Phase 8 chain comment |
| 15 | Add `timeout-minutes` to build steps | LOW | copilot-automation.ts | Phase 3 steps |

**P1 — Fix post-deploy:**

| # | Fix | Severity | File |
|---|-----|----------|------|
| 16 | Implement `workflow_dispatch` input (Phase 0 manual trigger) or remove | MED | copilot-automation.ts |
| 17 | Split Phase 5 approve/merge permissions | MED | copilot-automation.ts |
| 18 | Add `::add-mask::` for Supabase secrets | MED | copilot-automation.ts |

### Phase C: CLI Agent Cleanup

| # | Fix | Severity | File |
|---|-----|----------|------|
| 19 | Deprecate `prCompletionTracker` — Phase 8 handles this | CRITICAL | pr-agents.ts |
| 20 | Deprecate `prReviewAgent` — Phases 3/6 handle DB detection | CRITICAL | pr-agents.ts |
| 21 | Keep `copilotAssignAgent` as manual fallback | Info | issue-agents.ts |
| 22 | Update `stalledIssueDetector` — check PR commit count | HIGH | issue-agents.ts |
| 23 | Add phase-coverage check to audit scoring | HIGH | audit-agents.ts |

### Phase D: Repo Configuration

| # | Fix | Severity | Target |
|---|-----|----------|--------|
| 24 | Delete `enforce-pr-creation.yml` from damieus | CRITICAL | damieus-com-migration/.github/workflows/ |
| 25 | Enable "Allow auto-merge" in all 5 repos | CRITICAL | GitHub repo settings |
| 26 | Verify Supabase secrets per repo | CRITICAL | `gh secret list` per repo |
| 27 | Merge FFS worktree branch to main (or update registry) | CRITICAL | flipflops-sundays-reboot |
| 28 | Fix maximus registry: `hasE2E: true` | HIGH | repo-registry.ts |

### Phase E: Deploy to Repos

| # | Item | Command |
|---|------|---------|
| 29 | Deploy updated workflows to all 5 repos | `npx tsx src/index.ts deploy damieus ffs maximus cae 043` |
| 30 | Verify each repo's `copilot-full-automation.yml` has all 8 jobs | `grep -c 'Phase [1-8]' .github/workflows/copilot-full-automation.yml` |

### Phase F: Commit & Push

| # | Item | Commit message |
|---|------|---------------|
| 31 | Commit UGWTF | `feat: harden 8-phase 30x pipeline with security + edge-case fixes` |
| 32 | Push UGWTF | `git push origin main` |
| 33 | For each repo: commit updated workflows, push | `feat: deploy hardened 30x Copilot automation pipeline` |

---

## 8. Further Considerations (Resolved)

### 8.1 Copilot Assignment API

**Problem**: `assignees: ['copilot']` via `github.rest.issues.addAssignees()` silently fails in the REST API. The API returns 200 OK but Copilot is not actually assigned.

**Documented limitation**: The Copilot coding agent is triggered by a combination of:
1. The `agent:copilot` label on the issue
2. The "automation:copilot" label being present
3. The comment from Phase 1 activating the pipeline
4. GitHub's internal Copilot agent dispatch (not accessible via public API)

**Current workaround**: The `mcp_github2_assign_copilot_to_issue` MCP tool works from the VS Code context because it uses a different authentication path with Copilot-specific permissions.

**Resolution for the generated workflow**: The workflow should **keep** the `assignees: ['copilot']` call wrapped in a try/catch (current behavior) because:
1. It may work in future GitHub API versions
2. The pipeline doesn't depend on assignment success — it depends on the **label mechanism** triggering Copilot
3. The fallback comment post provides sufficient context for Copilot to discover the issue

**Additional mechanism**: Add a `workflow_dispatch` implementation (Item 16) that allows manual triggering of the pipeline for cases where automatic assignment fails. This provides an escape hatch:

```bash
gh workflow run copilot-full-automation.yml \
  --repo DaBigHomie/{repo} \
  -f issue_number=42
```

**Decision**: Keep current `assignees: ['copilot']` with try/catch. Implement `workflow_dispatch` as manual fallback. Document limitation in pipeline comments. The UGWTF CLI `copilotAssignAgent` remains available as an additional fallback via MCP.

### 8.2 E2E Testing in Copilot Pipeline

**Problem**: Phase 3 intentionally skips E2E tests for speed. Full Playwright E2E suites can take 5-15 minutes and require browser binaries.

**Analysis**:

| Repo | Has E2E | E2E Command | Typical Duration |
|------|---------|-------------|-----------------|
| damieus | Yes | `npx playwright test` | ~3-5 min |
| ffs | Yes | `npx playwright test` | ~2-4 min |
| 043 | Yes | `npm run test:e2e` | ~3-5 min |
| maximus | No* | `npx playwright test` | N/A (not configured) |
| cae | No | N/A | N/A |

\* maximus has playwright in `package.json` but `hasE2E: false` in registry — needs correction.

**Resolution: Add Optional Phase 3.5 with `continue-on-error: true`**

```yaml
  # PHASE 3.5: E2E VALIDATION (optional, non-blocking)
  e2e-validation:
    name: "Phase 3.5: E2E Tests (optional)"
    runs-on: ubuntu-latest
    needs: validate-pr
    if: |
      needs.validate-pr.outputs.all_checks_passed == 'true' &&
      ${repo.hasE2E ? 'true' : 'false'}
    continue-on-error: true
    permissions:
      contents: read
      pull-requests: write

    steps:
      - name: Checkout PR code
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '${repo.nodeVersion}'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci --ignore-scripts && npm rebuild

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: ${repo.e2eCommand}
        timeout-minutes: 15
        continue-on-error: true

      - name: Comment E2E results
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            // Post E2E results as informational (non-blocking)
```

**Key design decisions**:
- `continue-on-error: true` on the **job level** — E2E results are informational, not blocking
- Only runs if Phase 3 quality checks pass (don't waste runner time on failing PRs)
- Only generated for repos where `hasE2E: true`
- Installs only Chromium (not all browsers) for speed
- 15-minute timeout prevents runaway test suites
- Does NOT affect Phase 5 auto-merge — merge proceeds regardless of E2E outcome

**Implementation**: Conditionally inject Phase 3.5 YAML in `generateCopilotFullAutomation()` when `repo.hasE2E === true`.

### 8.3 Audit Logging for Auto-Approve/Merge Actions

**Problem**: No external audit trail for when the pipeline auto-approves and merges PRs. If something goes wrong (e.g., malicious code merged), there's no structured log to review.

**Resolution: Add structured logging to issue comments**

The pipeline should post a **structured audit block** in the PR comment for Phase 5 (auto-approve/merge):

```markdown
## Phase 5: Auto-Approve & Merge

| Action | Status |
|--------|--------|
| Auto-approve | Done |
| Auto-merge | Enabled (squash) |

### Audit Trail
| Field | Value |
|-------|-------|
| Pipeline run | #${run_id} |
| Triggered by | ${actor} |
| PR author | ${pr_author} |
| Commit SHA | ${head_sha} |
| Quality gates | tsc: ✅ | lint: ✅ | build: ✅ |
| DB migration | None detected |
| E2E tests | ${e2e_status} |
| Approved at | ${timestamp} |
| Merge strategy | Squash |
```

**Additional logging opportunities**:

1. **Issue comment on linked issue** — When Phase 8 closes an issue, include the PR number, merge SHA, and pipeline run ID
2. **GitHub Actions annotations** — Use `core.notice()` to create workflow annotations visible in the Actions UI
3. **Repo-level audit file** — Append to `.github/audit/pipeline-log.jsonl` (one JSON line per pipeline run) — but this requires `contents: write` permission and creates merge conflicts

**Recommended approach**: Issue/PR comments only (no file-based logging). Comments are:
- Immutable (can't be silently edited by non-admins)
- Searchable via GitHub API
- Visible in PR timeline
- Don't create merge conflicts

**Implementation**: Add `run_id`, `actor`, `head_sha`, and timestamp to Phase 5 and Phase 8 comment templates.

---

## 9. Repo Configuration Matrix

### 9.1 Complete Repo Registry

| Property | damieus | ffs | 043 | maximus | cae |
|----------|---------|-----|-----|---------|-----|
| **Slug** | DaBigHomie/damieus-com-migration | DaBigHomie/flipflops-sundays-reboot | DaBigHomie/one4three-co-next-app | DaBigHomie/maximus-ai | DaBigHomie/Cae |
| **Framework** | vite-react | vite-react | nextjs | nextjs | vite-react |
| **Node version** | 20 | 20 | 20 | 20 | 20 |
| **Default branch** | main | main | main | main | main |
| **Supabase ID** | okonslamwxtcoekuhmtm | tyeusfguqqznvxgloobb | bgqjgpvzokonkyiljasj | ycqtigpjjiqhkdecwiqt | null |
| **Types path** | src/integrations/supabase/types.ts | src/integrations/supabase/types.ts | src/lib/supabase/types.ts | src/shared/types/database.ts | null |
| **Has E2E** | ✅ | ✅ | ✅ | ❌ → ✅ (needs fix) | ❌ |
| **E2E command** | npx playwright test | npx playwright test | npm run test:e2e | null → npx playwright test | null |
| **Extra labels** | ecommerce, persona-impl | events, checkout | 8 (ecommerce, checkout, pdp, admin, orders, conversion, marketing, social) | agents, payments | cultural, conversion |
| **Local path** | ~/management-git/damieus-com-migration | ~/management-git/flipflops-sundays-reboot | ~/management-git/one4three-co-next-app | ~/management-git/maximus-ai | ~/management-git/cae-luxury-hair |

### 9.2 Known Repo Issues

| Repo | Issue | Severity | Resolution |
|------|-------|----------|------------|
| damieus | `enforce-pr-creation.yml` conflicts with Phase 1 | CRITICAL | Delete the file |
| ffs | Currently on branch `copilot-worktree-2026-01-31T01-02-34`, not `main` | CRITICAL | Merge to main or update registry |
| maximus | `hasE2E` set to `false` but package.json has playwright | HIGH | Fix to `true` in registry |
| All | Auto-merge may not be enabled in repo settings | CRITICAL | Enable via GitHub UI or API |
| All | Supabase secrets not verified | CRITICAL | Run `gh secret list` per repo |

---

## 10. CLI Agent Architecture

### 10.1 Agent Inventory (7 Clusters, 23+ Agents)

```
UGWTF CLI
├── Cluster: labels (Wave 1)
│   ├── universalLabelSync      — Sync 23 universal labels
│   └── repoLabelSync           — Sync repo-specific labels
│
├── Cluster: workflows (Wave 2, depends: labels)
│   ├── deployCI                — Generate ci.yml
│   ├── deployCopilotAutomation — Generate copilot-full-automation.yml ← THIS FILE
│   ├── deploySecurityAudit     — Generate security-audit.yml
│   ├── deployDependabot        — Generate dependabot-auto-merge.yml
│   ├── deploySupabaseMigration — Generate supabase-migration-automation.yml (conditional)
│   └── validateWorkflows       — Verify deployed YAML matches generated
│
├── Cluster: quality (Wave 1)
│   ├── typescriptValidator     — npx tsc --noEmit
│   ├── eslintValidator         — npm run lint
│   ├── buildValidator          — npm run build
│   └── configHealthCheck       — Verify tsconfig, package.json, copilot-instructions
│
├── Cluster: issues (Wave 2, depends: labels)
│   ├── stalledIssueDetector    — Find issues >48h without PR
│   ├── copilotAssignAgent      — Assign Copilot to agent:copilot issues
│   └── issueTriageAgent        — Auto-label by keyword regex
│
├── Cluster: prs (Wave 3, depends: labels, quality)
│   ├── prReviewAgent           — Review Copilot PRs, DB migration firewall ← DEPRECATE
│   ├── prBatchProcessor        — Label stale drafts
│   └── prCompletionTracker     — Track merged PRs, update issues ← DEPRECATE
│
├── Cluster: audit (Wave 4, depends: labels, workflows, quality)
│   ├── fullAuditAgent          — Score 4 domains (labels, workflows, issues, prs)
│   └── scoreboardAgent         — Generate cross-repo SCOREBOARD.json
│
└── Cluster: prompts (Wave 2, depends: labels)
    ├── promptScanner           — Find .prompt.md files
    ├── promptValidator         — Validate prompt structure
    └── promptIssueCreator      — Create GitHub issues from prompts
```

### 10.2 CLI↔Workflow Overlap (Post-Hardening)

After deprecating `prCompletionTracker` and `prReviewAgent`, the CLI and workflow pipeline have clean separation:

| Responsibility | CLI Agent | Workflow Phase | Overlap? |
|---------------|-----------|---------------|----------|
| Issue triage | `issueTriageAgent` | Phase 1 (label-triggered) | Complementary — CLI keyword triage, workflow label-triggered |
| Copilot assignment | `copilotAssignAgent` | Phase 1 | CLI as fallback only |
| Stalled detection | `stalledIssueDetector` | (none) | CLI-only — no workflow equivalent |
| Quality validation | quality cluster | Phase 3 | CLI for local, workflow for CI |
| DB migration detection | (deprecated) | Phase 6 | Workflow-only |
| PR completion tracking | (deprecated) | Phase 8 | Workflow-only |
| Audit scoring | audit cluster | (none) | CLI-only |
| Label sync | labels cluster | (none) | CLI-only |
| Workflow deployment | workflows cluster | (none) | CLI-only |

### 10.3 Execution Waves

```
Wave 1 (parallel):  labels, quality
Wave 2 (parallel):  workflows, issues, prompts
Wave 3:             prs
Wave 4:             audit
```

Waves execute in order — clusters within the same wave can run in parallel.

### 10.4 CLI Commands

| Command | Clusters Activated | Purpose |
|---------|-------------------|---------|
| `deploy` | labels, workflows | Sync labels + write workflow YAML files |
| `validate` | quality | Run local quality gates |
| `fix` | labels, workflows, quality | Auto-fix all issues |
| `labels` | labels | Only sync labels |
| `issues` | issues | Triage, stalled detection, Copilot assignment |
| `prs` | prs | Process PRs (post-deprecation: batch processing only) |
| `audit` | audit | Full health scorecard |
| `status` | audit | Quick health snapshot |
| `prompts` | prompts | Scan/validate .prompt.md files |

---

## 11. Verification & Rollout

### 11.1 Pre-Deploy Verification

```bash
# 1. TypeScript must compile
cd ~/management-git/ugwtf
npx tsc --noEmit

# 2. Verify hardened npm ci
grep -n 'ignore-scripts' src/generators/copilot-automation.ts

# 3. Verify max retry counter
grep -n 'MAX_ATTEMPTS\|max_attempts\|retry_count' src/generators/copilot-automation.ts

# 4. Verify comment dedup
grep -n 'findComment\|update.*comment\|existing.*comment' src/generators/copilot-automation.ts

# 5. Verify Phase 8 concurrency
grep -n 'copilot-chain' src/generators/copilot-automation.ts
```

### 11.2 Deployment

```bash
# Deploy to all 5 repos
npx tsx src/index.ts deploy damieus ffs maximus cae 043

# Verify deployed YAML
for repo in damieus-com-migration flipflops-sundays-reboot one4three-co-next-app maximus-ai cae-luxury-hair; do
  echo "=== $repo ==="
  grep -c 'Phase [1-8]' ~/management-git/$repo/.github/workflows/copilot-full-automation.yml
done
# Expected: 8 matches per repo
```

### 11.3 Post-Deploy Smoke Test

1. **Create test issue** in one repo with labels `agent:copilot` + `automation:copilot` + `priority:p3`
2. **Verify Phase 1** triggers:
   - Copilot assignment comment posted
   - `automation:in-progress` label added
   - Branch `copilot/issue-{N}` created
   - Draft PR opened
3. **Verify Phase 2** triggers when Copilot pushes commits:
   - Draft promoted to ready
   - Copilot review requested
4. **Verify Phase 3** runs quality checks:
   - tsc, lint, build all execute
   - Results comment posted
5. **Verify Phase 5** merges (if checks pass):
   - Auto-approve posted
   - Squash merge enabled
6. **Verify Phase 8** closes issue and chains:
   - Linked issue closed with `automation:completed` label
   - Next issue (if any) gets Copilot assigned

### 11.4 Audit Verification

```bash
# Run full audit after deployment
npx tsx src/index.ts audit damieus ffs maximus cae 043 --verbose

# Target scores (post-hardening):
# damieus:  96% → 99%+
# ffs:      79% → 90%+
# maximus:  90% → 95%+
# cae:      99% → 99%+
# 043:      86% → 95%+
```

### 11.5 Rollback Plan

If the hardened pipeline causes issues:

1. **Revert workflow YAML**: Each repo's `copilot-full-automation.yml` can be reverted via git
2. **Disable pipeline**: Remove `automation:copilot` / `automation:full` labels from issues
3. **Manual override**: Use `needs-review` label to block auto-merge
4. **CLI fallback**: Use UGWTF CLI agents for manual PR processing

No destructive operations are performed by the pipeline — it only creates PRs, posts comments, and manages labels. All actions are reversible.

---

## Appendix A: Generated Workflow YAML Structure

The `copilot-full-automation.yml` file generated for each repo contains:

```
Total jobs: 8
Total steps: ~35
YAML size: ~800 lines (varies by repo)
```

**Job dependency graph:**

```
trigger-pr-creation (Phase 1)  ─── independent
promote-and-review  (Phase 2)  ─── independent  
validate-pr         (Phase 3)  ─── independent
implement-feedback  (Phase 4)  ─── independent
auto-merge          (Phase 5)  ─── needs: validate-pr (Phase 3 pass + no DB)
db-migration-hold   (Phase 6)  ─── needs: validate-pr (Phase 3 pass + has DB)
handle-failure      (Phase 7)  ─── needs: validate-pr (Phase 3 fail)
post-merge-cleanup  (Phase 8)  ─── independent (triggered by PR close)
```

## Appendix B: Label Taxonomy (23 Universal + Per-Repo)

**Priority tier** (4): `priority:p0` through `priority:p3`  
**Automation tier** (6): `automation:copilot`, `automation:full`, `automation:partial`, `automation:manual`, `automation:in-progress`, `automation:completed`  
**Agent** (1): `agent:copilot`  
**Status** (3): `needs-pr`, `stalled`, `needs-review`  
**Category** (7): `database`, `infrastructure`, `enhancement`, `bug`, `documentation`, `dependencies`, `security`  
**Merge safety** (3 — actually 2 + 1): `safe-migration`, `destructive-migration`, `types-update`  

**Total universal**: 23 labels deployed to every repo

## Appendix C: Security Threat Model

| Threat | Vector | Phase | Mitigation |
|--------|--------|-------|------------|
| Supply chain via npm | Malicious `preinstall` script in PR | Phase 3 | `npm ci --ignore-scripts` |
| Title injection | Issue title with markdown/scripts | Phase 1 | Sanitize title |
| Duplicate PR creation | Concurrent issue events | Phase 1 | Branch-exists check |
| Infinite CI loop | Phase 7→3→7 unlimited retries | Phase 7 | Max 3 attempts counter |
| Comment flooding | New comment on every retry | All | Find/update existing comment |
| Double issue assignment | Concurrent Phase 8 merges | Phase 8 | Dedicated concurrency group |
| Secret exposure | Supabase keys in logs | Phase 6 | `::add-mask::` masking |
| Scope escalation | `pull_request_target` runs with base permissions | Phase 3 | `--ignore-scripts`, limited scope |

---

*Document generated by UGWTF Multi-Cluster Forecasting Swarm (4 agents, 7 clusters)*  
*Pipeline source: `@dabighomie/ugwtf` v1.0.0 — `src/generators/copilot-automation.ts`*
