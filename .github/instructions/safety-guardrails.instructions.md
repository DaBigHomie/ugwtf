---
applyTo: "**/*"
---

# Safety Guardrails — All Agents

## Destructive Operations

- **NEVER** run `rm -rf`, `rm -r`, or recursive delete on workspace directories
- **NEVER** delete the current working directory (CWD) or any parent of CWD
- **NEVER** run `pkill`, `killall`, or pattern-based kill commands
- **NEVER** copy files from `~/.copilot/session-state/` to repo directories
- **NEVER** run `git branch -D` (force delete) — use `git branch -d` (safe delete) after user confirms

## Confirmation Required

These operations MUST be presented as a report table first and require explicit user confirmation:
- Deleting git branches
- Removing git worktrees
- Killing processes (must confirm specific PIDs)
- Deleting files or directories

## Documentation Output Paths

- Always use absolute paths: `~/management-git/{repo}/docs/context-manifests/{date}/`
- Never write to CWD, `/tmp`, or session-state directories
- Create output directories with `mkdir -p` before writing
