# 40X Gap Analysis — Implementation Checklist

> **Repo**: `@dabighomie/ugwtf` v1.0.0  
> **Branch**: `feat/40x-gap-analysis`  
> **Created**: March 17, 2026  
> **Scope**: 31 gaps across 7 categories (Cat 2 — Missing Repos — excluded)

---

## P0 — Critical (Must-Have Before v1.1)

### Cat 1: Testing Infrastructure
- [x] **G1** Install `vitest` as dev dependency
- [x] **G2** Create `vitest.config.ts` with ESM + path aliases
- [x] **G3** Add `test` and `test:coverage` npm scripts
- [x] **G4** Create mock for GitHub client (`src/__mocks__/github.ts`)
- [x] **G5** Create mock for logger (`src/__mocks__/logger.ts`)
- [x] **G6** Unit test: `src/utils/fs.ts` (`writeFile`, `repoPath`, `yamlStr`)
- [x] **G7** Unit test: `src/utils/logger.ts` (`createLogger`)
- [x] **G8** Unit test: `src/config/repo-registry.ts` (`getRepo`, `allAliases`)
- [x] **G9** Unit test: `src/orchestrator.ts` (`orchestrate`, `COMMAND_CLUSTER_MAP`)
- [x] **G10** Unit test: `src/index.ts` (`parseArgs`)
- [x] **G11** Unit test: `src/swarm/executor.ts` (`runAgent`, `runCluster`, `summarize`)
- [x] **G12** Unit test: `src/clusters/index.ts` (`clusterExecutionOrder`, `getClusters`)
- [x] **G13** Add coverage threshold (`≥60%` lines) in vitest config

### Cat 3: CI/CD
- [x] **G14** Create `README.md` with install, usage, architecture, contributing
- [x] **G15** Create `.github/workflows/ci.yml` (type-check + lint + test on PR)
- [x] **G16** Create `.github/workflows/release.yml` (tag → build → publish placeholder)
- [x] **G17** Add `lint` npm script (`tsc --noEmit`)

---

## P1 — High (Next Sprint)

### Cat 4: Result Persistence & Output
- [x] **G18** Add `--output` flag to CLI (json, markdown, summary)
- [x] **G19** Create `src/output/json-reporter.ts` — write `SwarmResult` to JSON file
- [x] **G20** Create `src/output/markdown-reporter.ts` — write audit markdown
- [x] **G21** Persist last-run results to `.ugwtf/last-run.json`

### Cat 5: Auto-Fix Agent Depth
- [x] **G22** `fix-label-agent` — sync missing labels, remove orphans
- [x] **G23** `fix-workflow-agent` — overwrite drifted workflow files
- [x] **G24** `fix-types-agent` — regen Supabase types if stale
- [x] **G25** `fix-config-agent` — write missing `tsconfig.json`, `eslint.config.*`

### Cat 6: Shared Utilities
- [x] **G26** Extract `withRetry()`, `parseJsonSafe()`, `slugify()` into `src/utils/common.ts`

---

## P2 — Medium (Stability & Scale)

### Cat 7: Agent Depth (Thin Clusters)
- [x] **G27** Add 2+ agents to `email-agents.ts` (currently 1) — added emailTemplateValidator, emailWebhookChecker
- [x] **G28** Add 2+ agents to each 2-agent cluster — testCoverageConfigChecker, agentsMdChecker, envExampleChecker
- [x] **G29** N/A — all agents already have real `execute()` logic (verified via subagent audit)

### Cat 8: Structured Output
- [x] **G30** Define `AgentFinding` type (severity, file, line, message, fix) in types.ts
- [x] **G31** Return `AgentFinding[]` from all 5 new agents
- [x] **G32** Findings formatter (CLI table + markdown), wired into orchestrator + reporters

### Cat 9: Async GitHub Client
- [x] **G33** Replace `execSync` with `execFile`/`spawn` async — full rewrite
- [x] **G34** Rate-limit backoff (auto 5s pause when < 10 remaining)
- [x] **G35** GET response caching (Map-based, 60s TTL)

### Cat 10: SCOREBOARD
- [x] **G36** Auto-generate `SCOREBOARD.json` from audit results
- [x] **G37** Trend tracking (compare with previous SCOREBOARD, up/down/stable)
- [x] **G38** Emit SCOREBOARD as markdown with repo health table

---

## P3 — Low (Polish & Extensibility)

### Cat 11: Documentation
- [x] **G39** Create `docs/ARCHITECTURE.md` — swarm execution model, cluster DAG
- [x] **G40** Create `docs/ADDING-AGENTS.md` — how to write a new agent
- [x] **G41** Create `docs/ADDING-REPOS.md` — how to register a new repo
- [x] **G42** Add JSDoc to all exported functions

### Cat 12: CLI Improvements
- [x] **G43** Add `ugwtf list` — show all clusters, agents, repos
- [x] **G44** Add `ugwtf run <agent-id>` — run a single agent
- [x] **G45** Accept `.ugwtfrc.json` config file for default options

### Cat 13: Plugin / Extension System
- [x] **G46** Define `UGWTFPlugin` interface (register clusters, agents, commands)
- [x] **G47** Load plugins from `node_modules/@ugwtf/*`
- [x] **G48** Allow external repos to register without editing `repo-registry.ts`

### Cat 14: Config File Support
- [x] **G49** Support `.ugwtfrc.json` or `ugwtf.config.ts` per-repo
- [x] **G50** Override `nodeVersion`, `framework`, `extraLabels` via config file
- [x] **G51** Merge file config with repo-registry defaults

### Cat 15: Watch / Incremental Mode
- [x] **G52** Add `--watch` flag for continuous validation
- [x] **G53** Cache last agent results, skip unchanged repos
- [x] **G54** Emit file-change events to trigger targeted re-runs

---

## P4 — Carryover (From PHASE-CHECKLIST.md)

### Phase 2 Carryover: UGWTF ↔ audit-orchestrator Integration
- [x] **C1** Cluster registration via `registerCluster()` — plugin export created in audit-orchestrator (`src/ugwtf-plugin.ts`)
- [x] **C2** Shared type exports — canonical types exported from ugwtf via `./types` sub-path; audit-orchestrator imports them
- [x] **C3** Visual audit cluster wired into UGWTF swarm executor — `src/clusters/index.ts:120`
- [x] **C4** Audit results flow into SCOREBOARD.json — SCOREBOARD.json auto-generated
- [x] **C5** `--cluster visual-audit` flag works from CLI — cluster in `CLUSTERS[]` array
- [x] **C6** README documents audit-orchestrator as a UGWTF plugin — referenced in README
- [x] **C7** Version lock — `file:` link removed; audit-orchestrator inlined into `src/audit-orchestrator/`
- [x] **C8** Integration test — 2 test files reference audit-orchestrator cluster

### Phase 3 Carryover: GitHub Actions + Multi-Repo
- [x] **C9** `.github/workflows/ci.yml` — type-check + test on PR — already exists
- [x] **C10** `.github/workflows/ugwtf-audit.yml` — nightly audit run — exists
- [x] **C11** `.github/workflows/ugwtf-deploy.yml` — deploy workflows on merge — exists
- [~] **C12** GitHub App or PAT with fine-grained permissions for all 5 repos — DEFERRED (manual setup required)
- [~] **C13** `npx ugwtf deploy --all` runs from GitHub Actions — DEFERRED (needs C12 PAT first)
- [~] **C14** Audit SCOREBOARD posted as PR comment — CI exists but PR comment not confirmed
- [~] **C15** Slack/Discord notification on audit score regression — DEFERRED (no webhook configured, low priority)
- [x] **C16** Self-update: UGWTF CI validates its own codebase — `ci.yml` runs on push to main/feat/**
- [x] **C17** Dependabot config for UGWTF repo — `.github/dependabot.yml` exists
- [~] **C18** Branch protection rules on `main` — DEFERRED (requires GitHub Settings/API)
- [x] **C19** Release workflow: tag → build → publish — `release.yml` exists

### Open Risks
- [x] **R1** `file:` links — RESOLVED: no `file:` dependencies remain in package.json
- [~] **R2** `gh` CLI required on PATH — `gh` found but no graceful fallback if missing
- [x] **R3** ~~`execSync` blocks event loop~~ — RESOLVED: async `execFile`/`spawn` (G33)
- [~] **R4** `.env.example` exists but no auto-load — secrets still require manual export
- [x] **R5** ~~SCOREBOARD.json manually maintained~~ — RESOLVED: auto-generated (G36)

---

## Progress Summary

| Priority | Total | Done | Partial | % |
|----------|-------|------|---------|---|
| P0       | 17    | 17   | 0       | 100% |
| P1       | 9     | 9    | 0       | 100% |
| P2       | 12    | 12   | 0       | 100% |
| P3       | 16    | 16   | 0       | 100% |
| P4       | 24    | 17   | 7       | 71% (87% incl partial) |
| **Total**| **78**| **71**| **7** | **91%** |

> **P4 Deferred Items** (4): C12 (PAT setup), C13 (CI deploy --all), C15 (Slack webhook), C18 (branch protection) — require manual GitHub configuration, not code changes.
> **P4 Partial Items** (3): C14 (PR comment), R2 (gh fallback), R4 (.env auto-load) — functional but could be improved.
