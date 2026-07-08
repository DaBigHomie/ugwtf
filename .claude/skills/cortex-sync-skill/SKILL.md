---
name: cortex-sync-skill
description: "Manage ANVIL session lifecycles, database hydration, and task checkpoint pushes between local SQLite databases and Supabase cloud state."
---

# Cortex Sync Skill

This skill equips Antigravity with capabilities to automate session contracts and task synchronization.

## Workflows

### 1. Booting Session
On starting work in a repository, look for the CORTEX database:
1. Call `cortex-boot.mts` script:
   ```bash
   npx tsx ../.agent-kb/anvil/cortex-boot.mts --repo=<repo-slug> --agent=181
   ```
2. Read `.cortex-boot.json` immediately to load pending tasks, active assignments, and sprint references.
3. Validate that `env:global:cortex_sync` or local database configurations are set.

### 2. Checkpointing Progress
After resolving any ticket or code implementation:
1. Execute repository quality gates (`npm run build`, `npm run lint`, etc.).
2. Commit the changes using the format `feat(<scope>): <description>`.
3. Call the ANVIL checkpoint script to write back task state and sync to cloud:
   ```bash
   npx tsx ../.agent-kb/anvil/checkpoint.mts --task=<task_id> --status=complete
   ```

### 3. Closing Session & Seeding Artifacts
When completing all work:
1. Verify all checkpoints are complete.
2. Compile brain files (`task.md`, `walkthrough.md`, `implementation_plan.md`).
3. Seed artifact metadata into the CORTEX `knowledge` table:
   ```sql
   INSERT OR REPLACE INTO knowledge (key, repo, value, updated_at)
   VALUES (
     'artifact:maximus:walkthrough',
     'maximus-ai',
     json('{"type":"walkthrough","session":"sess_xxx","path":"brain/walkthrough.md","title":"Walkthrough Summary"}'),
     datetime('now')
   );
   ```
4. Run the close script:
   ```bash
   npx tsx ../.agent-kb/anvil/close.mts --session=<session_id>
   ```
