# 40X Gap Analysis — Implementation Checklist

> **Repo**: `@dabighomie/ugwtf` v1.0.0  
> **Branch**: `feat/40x-gap-analysis`  
> **Created**: March 17, 2026  
> **Scope**: 31 gaps across 7 categories (Cat 2 — Missing Repos — excluded)

---

## P0 — Critical (Must-Have Before v1.1)

### Cat 1: Testing Infrastructure
- [ ] **G1** Install `vitest` as dev dependency
- [ ] **G2** Create `vitest.config.ts` with ESM + path aliases
- [ ] **G3** Add `test` and `test:coverage` npm scripts
- [ ] **G4** Create mock for GitHub client (`src/__mocks__/github.ts`)
- [ ] **G5** Create mock for logger (`src/__mocks__/logger.ts`)
- [ ] **G6** Unit test: `src/utils/fs.ts` (`writeFile`, `repoPath`, `yamlStr`)
- [ ] **G7** Unit test: `src/utils/logger.ts` (`createLogger`)
- [ ] **G8** Unit test: `src/config/repo-registry.ts` (`getRepo`, `allAliases`)
- [ ] **G9** Unit test: `src/orchestrator.ts` (`orchestrate`, `COMMAND_CLUSTER_MAP`)
- [ ] **G10** Unit test: `src/index.ts` (`parseArgs`)
- [ ] **G11** Unit test: `src/swarm/executor.ts` (`runAgent`, `runCluster`, `summarize`)
- [ ] **G12** Unit test: `src/clusters/index.ts` (`clusterExecutionOrder`, `getClusters`)
- [ ] **G13** Add coverage threshold (`≥60%` lines) in vitest config

### Cat 3: CI/CD
- [ ] **G14** Create `README.md` with install, usage, architecture, contributing
- [ ] **G15** Create `.github/workflows/ci.yml` (type-check + lint + test on PR)
- [ ] **G16** Create `.github/workflows/release.yml` (tag → build → publish placeholder)
- [ ] **G17** Add `lint` npm script (`tsc --noEmit`)

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
- [ ] **G27** Add 2+ agents to `email-agents.ts` (currently 1)
- [ ] **G28** Add 2+ agents to each 2-agent cluster (24 files — batch)
- [ ] **G29** Implement real `execute()` logic for placeholder agents (currently only log messages)

### Cat 8: Structured Output
- [ ] **G30** Define `AgentFinding` type (severity, file, line, message, fix)
- [ ] **G31** Return `AgentFinding[]` from agent results (extend `AgentResult.artifacts`)
- [ ] **G32** Aggregate findings in CLI output table

### Cat 9: Async GitHub Client
- [ ] **G33** Replace `execSync` with `child_process.spawn` + async
- [ ] **G34** Add rate-limit backoff logic (429 / X-RateLimit-Remaining)
- [ ] **G35** Add response caching for repeated calls within a single run

### Cat 10: SCOREBOARD
- [ ] **G36** Auto-generate `SCOREBOARD.json` from audit results (replace manual edit)
- [ ] **G37** Add trend tracking (compare with previous SCOREBOARD)
- [ ] **G38** Emit SCOREBOARD as markdown for PR comments

---

## P3 — Low (Polish & Extensibility)

### Cat 11: Documentation
- [ ] **G39** Create `docs/ARCHITECTURE.md` — swarm execution model, cluster DAG
- [ ] **G40** Create `docs/ADDING-AGENTS.md` — how to write a new agent
- [ ] **G41** Create `docs/ADDING-REPOS.md` — how to register a new repo
- [ ] **G42** Add JSDoc to all exported functions

### Cat 12: CLI Improvements
- [ ] **G43** Add `ugwtf list` — show all clusters, agents, repos
- [ ] **G44** Add `ugwtf run <agent-id>` — run a single agent
- [ ] **G45** Accept `.ugwtfrc.json` config file for default options

### Cat 13: Plugin / Extension System
- [ ] **G46** Define `UGWTFPlugin` interface (register clusters, agents, commands)
- [ ] **G47** Load plugins from `node_modules/@ugwtf/*`
- [ ] **G48** Allow external repos to register without editing `repo-registry.ts`

### Cat 14: Config File Support
- [ ] **G49** Support `.ugwtfrc.json` or `ugwtf.config.ts` per-repo
- [ ] **G50** Override `nodeVersion`, `framework`, `extraLabels` via config file
- [ ] **G51** Merge file config with repo-registry defaults

### Cat 15: Watch / Incremental Mode
- [ ] **G52** Add `--watch` flag for continuous validation
- [ ] **G53** Cache last agent results, skip unchanged repos
- [ ] **G54** Emit file-change events to trigger targeted re-runs

---

## P4 — Carryover (From PHASE-CHECKLIST.md)

### Phase 2 Carryover: UGWTF ↔ audit-orchestrator Integration
- [ ] **C1** Cluster registration via `registerCluster()` — single import
- [ ] **C2** Shared type exports — `Agent`, `Cluster`, `AgentContext` from audit-orchestrator
- [ ] **C3** Visual audit cluster wired into UGWTF swarm executor
- [ ] **C4** Audit results flow into SCOREBOARD.json
- [ ] **C5** `--cluster visual-audit` flag works from CLI
- [ ] **C6** README documents audit-orchestrator as a UGWTF plugin
- [ ] **C7** Version lock — audit-orchestrator pinned in package.json
- [ ] **C8** Integration test — audit-orchestrator cluster runs in UGWTF pipeline

### Phase 3 Carryover: GitHub Actions + Multi-Repo
- [ ] **C9** `.github/workflows/ugwtf-ci.yml` — type-check + build on PR
- [ ] **C10** `.github/workflows/ugwtf-audit.yml` — nightly audit run
- [ ] **C11** `.github/workflows/ugwtf-deploy.yml` — deploy workflows to repos on merge
- [ ] **C12** GitHub App or PAT with fine-grained permissions for all 5 repos
- [ ] **C13** `npx ugwtf deploy --all` runs from GitHub Actions
- [ ] **C14** Audit SCOREBOARD posted as PR comment
- [ ] **C15** Slack/Discord notification on audit score regression
- [ ] **C16** Self-update: UGWTF CI validates its own codebase
- [ ] **C17** Dependabot config for UGWTF repo
- [ ] **C18** Branch protection rules on `main`
- [ ] **C19** Release workflow: tag → build → publish to npm (or private registry)

### Open Risks
- [ ] **R1** `file:../audit-orchestrator` link breaks in CI (no sibling folder)
- [ ] **R2** `gh` CLI required on PATH — no fallback
- [ ] **R3** `execSync` blocks event loop — large repos may timeout
- [ ] **R4** No `.env` handling — secrets must be manually exported
- [ ] **R5** SCOREBOARD.json manually maintained — drift risk

---

## Progress Summary

| Priority | Total | Done | % |
|----------|-------|------|---|
| P0       | 17    | 0    | 0% |
| P1       | 9     | 0    | 0% |
| P2       | 12    | 0    | 0% |
| P3       | 16    | 0    | 0% |
| P4       | 24    | 0    | 0% |
| **Total**| **78**| **0**| **0%** |
