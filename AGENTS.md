# Agent Instructions — @dabighomie/ugwtf

**Package**: `@dabighomie/ugwtf` v1.0.0  
**Purpose**: Unified GitHub Workflow Transformation Framework  
**Runtime**: Node 20+, ESM TypeScript, Vitest

## Quick Start

```bash
cd ~/management-git/ugwtf
export GITHUB_TOKEN=$(gh auth token)
node dist/index.js <command> [repos...] [flags]
```

## Agent Guide

| Doc | Covers |
|-----|--------|
| [00-QUICK-START](docs/agent-guide/00-QUICK-START.md) | Commands, flags, repos |
| [01-ARCHITECTURE](docs/agent-guide/01-ARCHITECTURE.md) | File tree, data flow |
| [02-AGENTS](docs/agent-guide/02-AGENTS.md) | All agents by cluster |
| [03-CLI](docs/agent-guide/03-CLI.md) | CLI reference |
| [08-APPROVAL-PIPELINE](docs/agent-guide/08-APPROVAL-PIPELINE.md) | PR lifecycle workflows |
| [10-PIPELINE-OPERATIONS](docs/agent-guide/10-PIPELINE-OPERATIONS.md) | Chain pipeline runbook |

## Pipeline Commands

```bash
# Setup
node dist/index.js prompts <alias> --no-cache --path <dir>
node dist/index.js generate-chain <alias> --no-cache --path <dir>

# Run
node dist/index.js chain <alias> --no-cache

# Monitor
node dist/index.js issues <alias> --no-cache
node dist/index.js prs <alias> --no-cache

# Recovery
node dist/index.js cleanup <alias> --no-cache
node dist/index.js dry-run <alias> --no-cache
```

## Copilot Assignment

- Assignee: `copilot-swe-agent[bot]` (NOT `copilot`)
- Requires `agent_assignment` payload with `target_repo` + `base_branch`
- Requires user PAT: `export GITHUB_TOKEN=$(gh auth token)`
- GHA `GITHUB_TOKEN` cannot start Copilot coding agent sessions
- UGWTF removes all assignee variants before re-adding (idempotent)
- Chain-advancer calls `assignCopilot()` directly (not GHA dispatch)

## GHA Workflows (PR Lifecycle)

| Workflow | Phase |
|----------|-------|
| `copilot-assign.yml` | Assign Copilot on `repository_dispatch: chain-next` |
| `copilot-pr-promote.yml` | Draft → ready, request Copilot review |
| `copilot-pr-validate.yml` | Validate, merge, DB firewall, retry |
| `copilot-pr-review.yml` | Re-assign on changes_requested |
| `copilot-pr-merged.yml` | Close issues, dispatch chain-next |
| `copilot-chain-advance.yml` | Advance chain on issue close |

## Anti-Bypass Rules

> **⛔ ALL chain operations MUST go through UGWTF CLI.**

- ❌ `github-assign_copilot_to_issue` MCP tool
- ❌ `github-issue_write` to modify chain issues
- ❌ `gh api` to modify chain state
- ❌ Assign Copilot to SP issues (use CH only)
- ✅ `ugwtf chain` to advance
- ✅ `ugwtf cleanup` to reset
- ✅ `ugwtf dry-run` to validate

## Build & Validate

```bash
npx tsc --noEmit     # 0 errors
npm run build        # succeeds
npx vitest run       # 400 tests pass
```
