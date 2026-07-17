# Agent Instructions — @dabighomie/ugwtf


## CORTEX Bootstrap (MANDATORY — run before any task)
```bash
# 1. Boot from CORTEX — writes .cortex-boot.json (14-section full session contract)
npx tsx ../.agent-kb/anvil/cortex-boot.mts --repo=ugwtf --agent={{your_id}}

# 2. Read the boot state — this file IS the session contract. Read it before any other file.
cat .cortex-boot.json
```
**`.cortex-boot.json` contains:** tasks, env locations, sprint context, gap analysis,
instruction file index, plan docs, automation scripts, CORTEX agents + local agents,
FORGE routing patterns, models, pre-filled write-back commands, token budget, MALFIG gates.

```bash
# 3. After task: checkpoint
npx tsx ../.agent-kb/anvil/checkpoint.mts --task={{task_id}} --status=complete

# 4. Session end (session ID is pre-filled in writeBack.closeSession):
npx tsx ../.agent-kb/anvil/close.mts --session={{session_id}}
```


## Quick Context
Read `.codebase-manifest.json` first. Only explore files referenced by the manifest.


**Package**: `@dabighomie/ugwtf` v1.0.0  
**Purpose**: Unified GitHub Workflow Transformation Framework  
**Runtime**: Node 20+, ESM TypeScript, Vitest

## Pre-Commit (MANDATORY)
```bash
npx tsc --noEmit && npm run lint && npm run build
```

## Full Reference
See `docs/AGENTS-REFERENCE.md` for: task tracking, GitHub automation, known limitations, project proposals, key docs table.