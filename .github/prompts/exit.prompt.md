---
description: "Session teardown: verify terminals/processes, commit with gates, write the same Context Manifest format as /context-manifest, post summary via SLACK_WEBHOOK_URL from this repo's .env, optional review issue. Use when: ending a session, switching repos, handing off to another agent."
argument-hint: "Optional repo hint (alias or path); omit to use the git root from cwd"
---

# /exit — Session Teardown

You are performing a **structured session teardown** — the inverse of `/context-manifest`. The **handoff artifact** uses the **same structure** as the Context Manifest (sections 1–7 below). Nothing here hardcodes a customer repo name: **discover the repo from the user argument or from `cwd`.**

## Step 0: Resolve the target repository

1. If the user passed an argument to `/exit` (alias, folder name, or path), `cd` to that repo root when valid.
2. Otherwise run `git rev-parse --show-toplevel` from the **current working directory** and use that path as the repo root.
3. Run all git, file, and quality commands **from that root** unless you are only reading global tooling.

**Report**: Print the resolved repo root path.

## Step 1: Verify terminals and processes

Stop orphaned dev servers, watchers, or test runners tied to this session. Use commands appropriate to the stack (infer from `package.json` scripts — do not assume Next/Vite only).

```bash
# Example: discover likely dev processes (trim output)
ps aux 2>/dev/null | head -5
# Inspect listening ports if helpful (trim output)
(lsof -iTCP -sTCP:LISTEN -P 2>/dev/null | head -10) || true
```

Prefer graceful shutdown; confirm PIDs before `kill`. **Report**: PIDs stopped or “none found.”

## Step 2: Verify and commit files

1. Git state (compact):

   ```bash
   git status --short
   git branch --show-current
   ```

2. If there are changes, run the repo’s quality gates — **only what exists** in `package.json` (examples: `npm run lint`, `pnpm lint`, `npx tsc --noEmit`). Pipe long output through `tail` (e.g. `| tail -20`).

3. Commit using conventional messages. If gates fail, still document failures in the manifest; prefer `wip(exit): …` when blocked.

4. Do **not** push to `main`/`master` without explicit user consent; on feature branches, push only if the user wants.

**Report**: branch, commit hash (if any), gate pass/fail summary.

## Step 3: Generate the handoff manifest (same format as `/context-manifest`)

Produce markdown using the **exact section numbering and intent** as **`/context-manifest`**:

1. **Completed Work** — tables + recent commits/PRs as applicable  
2. **Pending Logic Hurdles**  
3. **Architectural Decisions**  
4. **Next Steps**  
5. **User Intention**  
6. **Reference Links**  
7. **Agent Quickstart**

Gather context the same way as in **`context-manifest`** (git, optional `gh`/GitHub MCP, `AGENTS.md`, `.github/copilot-instructions.md`, `docs/` where present). If you need the full table templates, open **`.github/prompts/context-manifest.prompt.md`** in this repo and mirror **Step 3** there.

## Step 4: Save the manifest

Save to:

`docs/context-manifests/{YYYY-MM-DD}_{HH-mm}/CONTEXT_MANIFEST.md`

Create directories as needed. Use a real timestamp.

**Optional:** If this workspace has a sibling `documentation-standards` clone and manifests are maintained centrally, you may run (from **management-git** root):

`npx tsx documentation-standards/scripts/generate-manifests.mts`

with an alias only if you can derive it safely from the repo folder name or user input. Skip if not applicable.

## Step 5: Post to Slack (repo `.env` only)

Use the **Incoming Webhook** URL stored in **this repository’s** env files — **not** a hardcoded URL or another machine’s global file.

1. Search in order (first match wins): `.env`, `.env.local`, `.env.development.local` at the **repo root** for `SLACK_WEBHOOK_URL=...`.
2. If unset, **skip** Slack and state “no SLACK_WEBHOOK_URL in repo .env”.
3. If set, POST a short summary (session goal, branch, commit, link/path to the manifest file, gate status). Use `curl` with `Content-Type: application/json` and keep payloads small.

```bash
# Example: load URL without printing it to logs in full
WEBHOOK=$(grep -E '^SLACK_WEBHOOK_URL=' .env 2>/dev/null | sed -n '1p' | cut -d= -f2- | tr -d '"' | tr -d "'")
# Then POST a minimal JSON body (adapt text to your summary)
```

The webhook targets whatever channel was configured when the webhook was created (often `#handoffs`).

## Step 6: Optional agent review issue

If the session touched many files or gates failed, open a GitHub issue for follow-up review (labels like `agent-review` if your repo uses them). Skip for tiny clean sessions.

## Step 7: Final report

Print a short closing summary: repo path, branch, commit, manifest path, Slack sent/skipped, issue number if any.

---

## Standalone CLI (non–Copilot Chat)

For **Gemini CLI**, **Claude Code**, or scripts without this prompt, use the same flow via:

`npx tsx documentation-standards/scripts/exit-session.mts <alias>`

Run from your **management-git** workspace root (or pass paths accordingly). See **`--dry-run`**, **`--skip-slack`**, **`--skip-commit`** in that script’s header. That CLI uses **`SLACK_WEBHOOK_URL`** from env files it discovers — align repo `.env` the same way as above.

---

## Rules

- **No hardcoded repo names** — always resolve from argument + git + files on disk.  
- **Repo-local Slack secrets** — read `SLACK_WEBHOOK_URL` from this repo’s `.env*` only unless the user explicitly points elsewhere.  
- **Same manifest shape as `/context-manifest`** so the next agent can rely on one format.  
- **Safe git** — no `reset --hard`, no force-push, no deleting branches without explicit approval.  
- **Compact output** — trim logs (`tail`) to save tokens.
