---
name: git-hygiene
description: >-
  Git hygiene orchestrator to trigger pre-flight git-hygiene and safety gates in any repository.
  Strictly prevents destructive operations (git reset, git rm) that cause feature regression,
  and applies 50x logic for deep state tracing and pipeline verification.
---

# git-hygiene (`/git-hygiene`)

Workspace-wide Git hygiene orchestrator. Enforces safe, non-destructive workflows and integrates 50x logic to verify CORTEX DB state, linked worktrees, and branch alignment before any landing or checkout.

## Core Rules

> [!CAUTION]
> **NO DESTRUCTIVE GIT OPERATIONS:** 
> Do not execute `git reset --hard`, `git push --force`, or destructive branch/worktree deletions without explicit user approval. All operations must be fully reversible or run in dry-run mode first.

### 50x Logic Principles
- **CORTEX State Verification:** Check the local SQLite database state (`.agent-kb/db/agent_kb.sqlite`) and run `cortex-sync-guard.mts` if present before shifting branch states to ensure no session provenance is lost.
- **Pipeline Integrity:** Check `.cortex-boot.json` and verify that all workspace plugins and hooks are correctly loaded. Ensure there are no disconnected agents or stalled loops.
- **Loop/Workspace Audit:** Trace all linked sibling worktrees using `worktree-lint.mts` to ensure parallel tasks are properly isolated and do not clash on the same branch.

---

## Workflow

1. **Verify CORTEX DB State (50x logic)**
   Check the current session's SQLite state to ensure task registry and state hydration are aligned.
   ```bash
   npx tsx scripts/cortex-sync-guard.mts
   ```

2. **Audit Worktree Isolation**
   Run the worktree linter to detect overlapping branch mutations or uncommitted changes in linked sibling worktrees.
   ```bash
   npx tsx scripts/worktree-lint.mts
   ```

3. **Pre-flight Audit (`repo-sync-guard`)**
   Run the pre-flight tool with the global plugin path to refresh remote references and check tree cleanliness.
   ```bash
   npx tsx "~/.gemini/config/plugins/git-hygiene/scripts/repo-sync-guard.mts" <repo> --fetch
   ```
   *If findings are returned, resolve them via safe commits, pushes, or pulls. Run `/forecast-scrutiny` before any safe remediation (`--remediate`).*

4. **Target Integration Dry-Run (MANDATORY FOR PRs/MERGES)**
   If reviewing a Pull Request or preparing a branch for merge, you MUST explicitly test for conflicts against the target integration branch (e.g., `origin/main`). `git status` alone is INSUFFICIENT as it only compares against the isolated tracking branch.
   ```bash
   git fetch origin && gh pr view <PR_NUMBER> --json mergeable
   # OR
   git fetch origin && git merge origin/main --no-commit --no-ff
   git merge --abort
   ```
   *If the API returns `CONFLICTING` or the dry-run merge fails, the verdict MUST be BLOCKED.*

5. **Safety Check**
   Review proposed commands. Forbid any command that overwrites git history or deletes unmerged branches.

---

## Output Format

Emits compliance verdict matching MALFIG plain-text guidelines (no emoji):

```
TASK-XXXX — Git Hygiene Audit
Verdict: PASS | BLOCKED
Violations: (rule IDs, e.g., GH-001 Destructive git reset proposed, or NONE)
Actions: (safe sync/remediation steps, or NONE)
```
