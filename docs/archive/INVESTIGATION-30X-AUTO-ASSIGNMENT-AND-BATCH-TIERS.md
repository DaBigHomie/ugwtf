# 30x Deep Dive Investigation: UGWTF Auto-Assignment & Batch-by-Dependency-Tier

**Date**: June 2025  
**Scope**: Complete audit of how UGWTF handles GitHub Copilot auto-assignment and dependency-based batch execution  
**Trigger**: 12 Copilot PRs on one4three-co-next-app were essentially empty — 1/12 had real code, 1/12 hallucinated completion, 10/12 were empty scaffolds  
**Status**: Investigation Complete

---

## Executive Summary

UGWTF has **two separate assignment systems** and **one execution system** that were designed for **sequential advancement** but were used for **parallel batch assignment**, causing Copilot agent saturation. The chain system correctly sorts prompts by dependency tier (Kahn's algorithm), but the assignment transport layer silently fails via `gh` CLI, and bulk assignment overwhelms the Copilot coding agent.

### Root Cause (3 Failures)

| # | Failure | Impact |
|---|---------|--------|
| 1 | **Copilot assignment via `gh` CLI is unreliable** — `gh issue edit --add-assignee @copilot` may silently do nothing or error (e.g., "user not found") | Chain-advancer and advance-chain.mts cannot reliably assign Copilot |
| 2 | **No rate-limiting on issue-level Copilot assignment** — 12 issues assigned simultaneously via MCP tool | Copilot agent saturated, produced empty/hallucinated PRs |
| 3 | **No verification step after assignment** — system never confirms Copilot actually picked up the issue and started working | Silent failures go undetected indefinitely |

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    UGWTF Chain Pipeline                      │
│                                                             │
│  1. SCAN          2. SORT           3. CREATE    4. ASSIGN  │
│  ┌──────────┐    ┌──────────────┐   ┌────────┐  ┌────────┐ │
│  │ prompt   │───>│ chain-       │──>│ chain- │─>│ chain- │ │
│  │ scanner  │    │ generator    │   │ issue  │  │advancer│ │
│  │          │    │ (toposort)   │   │creator │  │        │ │
│  └──────────┘    └──────────────┘   └────────┘  └────────┘ │
│       │                │                 │           │      │
│  .prompt.md     prompt-chain.json   GitHub Issues  Copilot  │
│  files          (waves + deps)      (#92-#110)    assigned  │
│                                                             │
│  PARALLEL PATH (what went wrong):                           │
│  ┌──────────────────────────────────────┐                   │
│  │ MCP tool batch-assigned ALL 12 at    │                   │
│  │ once, bypassing sequential chain     │                   │
│  └──────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

---

## System 1: Auto-Assignment (3 Pathways)

### Pathway A: `issue-copilot-assign` Agent

**File**: `src/agents/issue-agents.ts` (L63-115)  
**Cluster**: `issues`  
**Trigger**: `npx tsx src/index.ts issues <repo>`

**Logic**:
1. Fetch all open issues with label `agent:copilot`
2. Filter out issues where `copilot` is already in `assignees`
3. Filter out issues that already have `automation:in-progress` label
4. For each remaining issue: `assignIssue(owner, repo, number, ['copilot'])` + add `automation:in-progress` label

**Transport**: Uses `ctx.github.assignIssue()`, which goes through the UGWTF GitHub client. That client **defaults to the `gh` CLI transport when available**, and otherwise falls back to a native `fetch`-based REST transport.

**Problem**: When the client routes via the `gh` CLI transport path, the REST API call to assign `copilot` **silently fails**. It returns 200 OK but Copilot is never actually assigned. This is a known GitHub platform limitation documented in `src/generators/copilot-automation.ts` L195-214.

```typescript
// From copilot-automation.ts — WORKAROUND DOCUMENTATION:
// The REST API call addAssignees({assignees: ['copilot']}) works
// reliably within GitHub Actions context but may silently fail
// via external API calls (gh CLI, MCP tools):
//   - gh issue edit --add-assignee @copilot → "user not found"
//   - gh api POST .../assignees → 200 OK but no actual assignment
// Fallback strategies (priority order):
//   1. This workflow (GitHub Actions context) — PREFERRED
//   2. GitHub Actions–only automation or other in-repo workflows that call
//      Octokit directly (no gh CLI / external transport). Note: the UGWTF
//      CLI `issue-copilot-assign` agent also uses the gh API transport and
//      is not reliable as a fallback when Copilot assignment via gh fails.
//   3. Manual: workflow_dispatch trigger on this workflow
```

**Assessment**: ❌ **UNRELIABLE** — Silent failure via gh CLI transport.

---

### Pathway B: `chain-advancer` Agent

**File**: `src/agents/chain-agents.ts` (L367-510)  
**Cluster**: `chain`  
**Trigger**: `npx tsx src/index.ts chain <repo>`

**Logic**:
1. Read `prompt-chain.json` from repo (looks in `scripts/`, root, `.github/`)
2. Fetch all open issues matching chain labels
3. Sort chain entries by `position` (ascending)
4. Find the **first** open issue in position order
5. Check if all dependencies are resolved (dependency issues are closed)
6. If deps unresolved → wait (return "Waiting on deps" message)
7. If deps resolved → post context comment → assign Copilot → add `automation:in-progress` label

**Critical Design**: Assigns **ONE issue at a time**. The loop `break`s after finding the first eligible entry. This is intentional — it's a sequential advancement system.

```typescript
// Line 413-414: finds first match and stops
const nextEntry = config.chain
  .sort((a, b) => a.position - b.position)
  .find(e => e.issue !== null && openIssueNumbers.has(e.issue));
```

**Dependency Check** (L440-449):
```typescript
for (const dep of nextEntry.depends) {
  const depEntry = config.chain.find(e => e.prompt === dep);
  if (depEntry?.issue && openIssueNumbers.has(depEntry.issue)) {
    unresolvedDeps.push(`${dep} (#${depEntry.issue})`);
  }
}
```

**Transport**: Same `ctx.github.assignIssue()` → gh CLI → **silently fails**.

**Assessment**: ✅ **CORRECT DESIGN** (sequential, dependency-aware) but ❌ **UNRELIABLE TRANSPORT** (same gh CLI issue).

---

### Pathway C: GitHub Actions Workflow (Generated)

**File**: `src/generators/prompt-chain-workflow.ts` (L1-250)  
**Trigger**: PR merges to `main` that references `Fixes #N` / `Closes #N`

**Logic**:
1. On PR merge → check if PR body contains `Fixes #N` or `Closes #N`
2. Find the closed issue in `prompt-chain.json`
3. Find the next entry in position order
4. Check if next entry's dependencies are all closed
5. Post context comment → add `automation:in-progress` label → assign Copilot

**Transport**: `github.rest.issues.addAssignees()` in **GitHub Actions** context — this is the **ONLY reliable method**.

```javascript
// Line ~180-190 of generated workflow:
await github.rest.issues.addAssignees({
  owner: context.repo.owner,
  repo: context.repo.repo,
  issue_number: nextEntry.issue,
  assignees: ['copilot']
});
```

**Assessment**: ✅ **CORRECT AND RELIABLE** — GitHub Actions context is the one transport that works.

---

### Pathway Comparison

| Pathway | Transport | Assignment | Dependency Check | Reliability |
|---------|-----------|------------|-----------------|-------------|
| A: `issue-copilot-assign` | gh CLI REST | All matching issues | ❌ None (label-based only) | ❌ Silent failure |
| B: `chain-advancer` | gh CLI REST | ONE at a time | ✅ Full dependency resolution | ❌ Silent failure |
| C: Workflow (generated) | GitHub Actions Octokit | ONE at a time | ✅ Full dependency resolution | ✅ Works |

---

## System 2: Batch-by-Dependency-Tier (Wave System)

### 2.1 Dependency Parsing

**File**: `src/agents/prompt-agents.ts` (L55-90)  
**Function**: `parseDependencies(content: string): string[]`

Parses 5 markdown formats from `.prompt.md` files:

| Format | Example | Regex |
|--------|---------|-------|
| Gap number | `**Dependencies**: #1, #3` | `/#(\d+)/g` |
| Prompt ID | `**Dependencies**: FI-01, FI-03` | `/([A-Z]+-\d+)/g` |
| Filename ref | `**Dependencies**: 01-supabase-client-setup` | `/(\d{2}-[a-z][a-z0-9-]+)/g` |
| None | `**Dependencies**: None` | `/^none\b/i` |
| Parallel hint | `**Dependencies**: can run in parallel` | `/can run in parallel/i` |

**Weakness**: Only matches lines starting with `**Dependencies**:` or `**Depends On**:`. If a prompt uses a different key (e.g., `**Requires**:`, bullet list deps, or YAML frontmatter), dependencies are silently dropped, and the prompt lands in Wave 1 with no deps.

---

### 2.2 Dependency Resolution

**File**: `src/agents/chain-agents.ts` (L555-610)  
**Function**: `resolveDeps(deps, promptMap, gapToId): string[]`

Resolves raw dependency strings to prompt IDs through 3 resolution strategies:

1. **Direct ID**: `FI-01` → check if known → use directly
2. **Gap number**: `#20` → look up `gapToId` map (file prefix number → prompt ID)
3. **Filename ref**: `01-supabase-client-setup` → look up `promptMap` (filename stem → prompt ID)

Unresolvable dependencies are **warned but skipped** — they don't block the chain. This means a typo in a dependency reference silently removes the dependency constraint, potentially allowing prompts to run out of order.

```typescript
if (unresolved.length > 0) {
  console.warn(
    `[chain-agents] Dependency references could not be resolved and were skipped. Please verify: ${unresolved.join(', ')}`,
  );
}
```

---

### 2.3 Topological Sort (Kahn's Algorithm)

**File**: `src/agents/chain-agents.ts` (L620-680)  
**Function**: `toposort(ids, depGraph): { sorted, waves }`

**Algorithm**:
1. Compute in-degree for each node (number of dependencies)
2. Initialize queue with all nodes having in-degree 0 → these are Wave 1
3. BFS: for each processed node, decrement in-degree of dependents
4. Wave assignment: `wave = max(wave of all resolved deps) + 1`
5. If sorted order has fewer nodes than input → cycle detected → throw error

**Wave Calculation**:
```typescript
// Wave = max(dependency waves) + 1
const existingWave = waves.get(dependent) ?? 0;
waves.set(dependent, Math.max(existingWave, currentWave + 1));
```

This means:
- A prompt with NO deps → Wave 1
- A prompt depending on Wave 1 prompt → Wave 2
- A prompt depending on Wave 1 AND Wave 3 prompts → Wave 4 (max + 1)

**Correctness**: ✅ Standard Kahn's algorithm with proper cycle detection. The wave calculation correctly computes the earliest possible execution wave for each prompt.

---

### 2.4 Chain Generation

**File**: `src/agents/chain-agents.ts` (L717-850)  
**Agent**: `chain-generator`  
**Trigger**: `npx tsx src/index.ts generate-chain <repo> [--path dir/]`

**Pipeline**:
1. Scan all `.prompt.md` files (via `scanAllPrompts`)
2. Optionally scope to `--path` subdirectory
3. Quality-score each prompt (warn if < 50%)
4. Sort by filename for stable ordering
5. Build ID maps: `fileName → promptId`, `#N → promptId`
6. Resolve dependencies for each prompt
7. Toposort + wave assignment
8. Build `ChainConfig` v3 JSON
9. Write to `scripts/prompt-chain.json`

**Safety check**: If existing `prompt-chain.json` has issues assigned, logs a warning but overwrites. Old GitHub issues are preserved — only the local config file changes.

---

### 2.5 Chain Issue Creation

**File**: `src/agents/chain-agents.ts` (L210-365)  
**Agent**: `chain-issue-creator`  
**Trigger**: `npx tsx src/index.ts chain <repo>` (after chain-config-loader)

**Logic**:
1. Read `prompt-chain.json`
2. Find entries with `issue: null`
3. For each: create GitHub issue with title `[Chain N/Total] ID: filename`
4. Labels: `config.labels` + priority label mapped from severity
5. Write back updated config with issue numbers

**Standalone script**: `scripts/create-chain-issues.mts` — same logic, uses `gh issue create` CLI.

**`--kick` flag**: After creating all issues, assigns Copilot to position 1. Uses `gh issue edit --add-label` (works) but does NOT assign Copilot directly (because `gh` CLI can't).

---

## System 3: Swarm Executor (Concurrency Control)

**File**: `src/swarm/executor.ts` (L148-170, L200-300)

### 3.1 Concurrency Limiter

```typescript
async function withConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  maxConcurrent: number,
): Promise<T[]> {
  const results: T[] = [];
  const running = new Set<Promise<void>>();

  for (const task of tasks) {
    const p = (async () => { results.push(await task()); })();
    running.add(p);
    p.finally(() => running.delete(p));

    if (running.size >= maxConcurrent) {
      await Promise.race(running);
    }
  }

  await Promise.all(running);
  return results;
}
```

**Default concurrency**: 3 (CLI `--concurrency` flag)

### 3.2 Execution Modes

| Mode | Behavior |
|------|----------|
| `sequential` | Process repos one-by-one, run all clusters per repo |
| `parallel` | Process repos concurrently (limited by `--concurrency`) |
| `fan-out` | Process clusters in wave order, fanning out to all repos per wave |

### 3.3 Critical Gap

The concurrency limiter controls **repo-level parallelism** (how many repos the swarm processes simultaneously). It does **NOT** control:
- How many issues are assigned to Copilot simultaneously
- How fast issues are created
- Cooldown between Copilot assignments

When 12 issues were assigned to Copilot at once (via MCP tool, not via swarm executor), there was no rate limiting, no cooldown, and no sequential pacing.

---

## What Happened with the o43 Failure

### Timeline

1. **Chain generated**: 19 `.prompt.md` files scanned → toposorted → `prompt-chain.json` with 19 entries across 4 waves
2. **Issues created**: 19 GitHub issues (#92-#110) created via `create-chain-issues.mts`
3. **Batch assignment**: 12 Wave 1 issues assigned to Copilot simultaneously via `mcp_github_assign_copilot_to_issue` MCP tool
4. **Copilot saturated**: Agent created 12 PRs in rapid succession
5. **Results**: 1 real implementation, 1 hallucinated (checkboxes ✅ but 0 diff), 10 empty scaffolds

### Why It Failed

| Factor | Expected | Actual |
|--------|----------|--------|
| Assignment method | Chain-advancer (1 at a time) | MCP batch (12 at once) |
| Copilot concurrency | 1 issue at a time | 12 simultaneous |
| Dependency enforcement | Toposort waves | Bypassed (all Wave 1) |
| Verification | Check PR has real changes | None — assumed success |
| Cooldown | Not implemented | N/A (no cooldown exists) |

---

## Findings Summary

### What Works

1. **Kahn's algorithm toposort** — Correct implementation with proper cycle detection and wave assignment
2. **Dependency parsing** — 5 format support covers most prompt conventions
3. **Chain generator** — Correctly scans, sorts, and generates `prompt-chain.json`
4. **Chain issue creator** — Correctly creates issues with labels and bodies
5. **GitHub Actions workflow** — The only reliable Copilot assignment transport
6. **Chain advancer design** — Sequential, dependency-aware, one-at-a-time advancement

### What Doesn't Work

1. **`gh` CLI Copilot assignment** — Silently fails. The `assignIssue()` method in `github.ts` uses `ghApi()` which wraps `gh api` — this does NOT reliably assign Copilot
2. **`advance-chain.mts` script** — Uses `gh issue edit` for labels (works) but has NO Copilot assignment step at all — it only comments and labels
3. **`create-chain-issues.mts --kick`** — Adds label but cannot assign Copilot (warns user to use MCP tool)
4. **No assignment verification** — After calling `assignIssue()`, no code checks if assignment actually took effect
5. **No Copilot rate limiting** — No mechanism to pace assignments or wait for completion before assigning next

### What's Missing

1. **Issue-level concurrency control** — The swarm executor limits repo concurrency but has no concept of "assign max N issues to Copilot at once"
2. **Assignment verification callback** — Need to poll issue assignees after assignment to confirm it worked
3. **PR activity monitoring** — After assignment, monitor if Copilot creates a PR with real changes (not empty scaffold)
4. **Sequential advancement enforcement** — When using MCP tools for assignment, there's no gate preventing batch assignment of Wave 1 issues
5. **Copilot completion signal** — No mechanism to detect when Copilot finishes one issue before assigning the next

---

## Recommended Fixes

### Fix 1: Replace `gh` CLI Transport for Copilot Assignment

The `assignIssue()` method in `src/clients/github.ts` must use the GitHub Actions context or Octokit directly, not the `gh` CLI wrapper.

**Options**:
- A) Use `mcp_github_assign_copilot_to_issue` as the primary assignment mechanism
- B) Trigger the generated workflow via `workflow_dispatch` event
- C) Use a GitHub App token with Octokit for direct REST calls

### Fix 2: Add Issue-Level Rate Limiting

Add a `maxCopilotConcurrency` option (default: 1) that limits how many issues can be in `automation:in-progress` state simultaneously.

```typescript
// Proposed: check active assignments before assigning next
const inProgress = await ctx.github.listIssues(owner, repo, 'open', ['automation:in-progress']);
if (inProgress.length >= maxCopilotConcurrency) {
  ctx.logger.warn(`Already ${inProgress.length} issues in-progress. Waiting.`);
  return { status: 'skipped', message: 'Rate limited' };
}
```

### Fix 3: Add Assignment Verification

After calling `assignIssue()`, poll the issue to confirm `copilot` appears in assignees:

```typescript
// Proposed: verify assignment took effect
const updated = await ctx.github.getIssue(owner, repo, issueNumber);
const assigned = updated.assignees.some(a => a.login === 'copilot');
if (!assigned) {
  ctx.logger.error(`Assignment failed silently for #${issueNumber}`);
  // Fallback: trigger workflow_dispatch or use MCP tool
}
```

### Fix 4: Add PR Quality Gate Before Advancing

Before advancing to the next chain entry, verify the current Copilot PR has:
- At least 1 non-lockfile file changed
- At least 10 lines of additions
- No empty "Initial plan" PRs

### Fix 5: Sequential-Only Mode for Copilot

Add a `--sequential-copilot` flag that:
1. Assigns Copilot to ONE issue
2. Waits for PR creation (poll every 60s, timeout 30min)
3. Verifies PR has real changes
4. Only then advances to the next issue

---

## File Reference

| File | Lines | Purpose |
|------|-------|---------|
| `src/agents/chain-agents.ts` | 367-510 | Chain advancer (sequential, 1-at-a-time) |
| `src/agents/chain-agents.ts` | 620-680 | Kahn's toposort + wave calculation |
| `src/agents/chain-agents.ts` | 717-850 | Chain generator (scan→sort→write) |
| `src/agents/chain-agents.ts` | 210-365 | Chain issue creator (create GitHub issues) |
| `src/agents/issue-agents.ts` | 63-115 | Issue-copilot-assign (label-based, no deps) |
| `src/agents/prompt-agents.ts` | 55-90 | Dependency parsing (5 formats) |
| `src/generators/prompt-chain-workflow.ts` | 1-250 | GitHub Actions workflow generator |
| `src/generators/copilot-automation.ts` | 195-214 | **Known assignment limitation documented** |
| `src/clients/github.ts` | 280-285 | `assignIssue()` — uses gh CLI (unreliable) |
| `src/swarm/executor.ts` | 148-170 | `withConcurrency()` limiter |
| `src/swarm/executor.ts` | 200-300 | 3 execution modes |
| `scripts/create-chain-issues.mts` | 1-160 | Standalone issue creation + kick |
| `scripts/advance-chain.mts` | 1-160 | Standalone chain advancement |

---

## Conclusion

The UGWTF chain system was **correctly designed for sequential advancement** with dependency awareness. The failure on o43 was caused by **bypassing the sequential system** and batch-assigning 12 issues to Copilot simultaneously via MCP tool. The underlying `gh` CLI transport for Copilot assignment is known to be unreliable, and this limitation is documented in the codebase but not enforced programmatically.

The fix is straightforward: (1) replace the assignment transport, (2) add rate limiting at the issue level, (3) verify assignments took effect, and (4) gate chain advancement on PR quality.
