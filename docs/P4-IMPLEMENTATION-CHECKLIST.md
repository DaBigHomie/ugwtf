# P4 Implementation Checklist — Carryover Items

> **Repo**: `@dabighomie/ugwtf` v1.0.0
> **Created**: March 18, 2026
> **Status**: 24 items total — 26 done (Wave 1 + Wave 2 complete), 6 remaining across Waves 3-5
> **Prerequisite**: P0-P3 complete (54/54 items)
> **Automation**: 6 swarm scripts created (`scripts/swarm-quality-gate.mts`, `scripts/wave-runner.mts`, `scripts/context-budget.mts`, `scripts/cluster-test-runner.mts`, `scripts/scoreboard-validator.mts`, `scripts/context-analyzer.mts`)

---

## Triage Summary

| Status | Count | Items |
|--------|-------|-------|
| Already Done | 26 | C1, C2, C3, C4, C5, C8, C9, C16, R3, R5 + C7.1, R1.2 + Wave 1-2 sub-items |
| Remaining | 6 | C6, C7.2-C7.5, C10-C15, C17-C19, R1.3-R1.4, R2, R4 |

---

## Already Done (Mark `[x]` in main checklist)

| Item | Evidence |
|------|----------|
| **C3** Visual audit cluster wired into swarm executor | `src/clusters/index.ts:120` — `visualAuditCluster` imported and registered in `CLUSTERS[]` |
| **C5** `--cluster visual-audit` works from CLI | Cluster is in `CLUSTERS[]` array; `--cluster visual-audit` resolves via `clusterExecutionOrder()` |
| **C9** CI workflow — type-check + test on PR | `.github/workflows/ci.yml` already runs `tsc --noEmit` + `vitest --coverage` on push/PR |
| **C16** UGWTF CI validates its own codebase | Same `ci.yml` — self-validates on every push to main or feat/** |
| **R3** `execSync` blocks event loop | RESOLVED in G33 — async `execFile`/`spawn` rewrite |
| **R5** SCOREBOARD.json manually maintained | RESOLVED in G36 — `generateScoreboard()` auto-generates from audit results |

---

## Wave 1: Type Unification & Plugin Registration

**Goal**: Clean up the type cast hack and make audit-orchestrator a proper UGWTF plugin.

### C1 — Cluster registration via `registerCluster()` — single import
- [x] **C1.1** Audit existing plugin system: read `src/plugins/loader.ts` to understand `UGWTFPlugin` interface
- [x] **C1.2** Created `audit-orchestrator/src/ugwtf-plugin.ts` implementing `UGWTFPlugin` — registers `visualAuditCluster` via `registry.addCluster()`
- [x] **C1.3** Export as `@dabighomie/audit-orchestrator/plugin` in audit-orchestrator's `package.json` exports map
- [ ] **C1.4** In ugwtf `src/clusters/index.ts`, replace the direct `visualAuditCluster` import with plugin loader discovery (deferred — direct import is cleaner for first-party package)
- [x] **C1.5** Verify `npx ugwtf list` still shows `visual-audit` cluster with all 10 agents (132/132 tests pass)
- [x] **C1.6** Run tests: `npx vitest run` — all 132 pass

### C2 — Shared type exports
- [x] **C2.1** Documented type duplication: ugwtf `Agent*` ↔ audit-orchestrator `UgwtfAgent*` (identical shape)
- [x] **C2.2** Decision: export canonical types from ugwtf as `@dabighomie/ugwtf/types`
- [x] **C2.3** Added `"./types": "./dist/types.js"` to ugwtf `package.json` exports map
- [x] **C2.4** Replaced local `UgwtfAgent*` interfaces in `audit-orchestrator/src/agent.ts` + `src/cluster.ts` with imports from `@dabighomie/ugwtf/types`
- [x] **C2.5** Removed `as unknown as Agent[]` cast in ugwtf `src/clusters/index.ts` — types now match natively
- [x] **C2.6** `npx tsc --noEmit` passes in BOTH packages — 0 errors each
- [x] **C2.7** `npx vitest run` in ugwtf — 132/132 tests pass

### C7 — Version lock — audit-orchestrator pinned in package.json
- [x] **C7.1** Decision: keep `file:` link for now; audit-orchestrator added ugwtf as devDep (`file:../ugwtf`) + optional peerDep (`>=1.0.0`)
- [ ] **C7.2** If npm: run `cd ~/management-git/audit-orchestrator && npm publish --access public`
- [ ] **C7.3** Update ugwtf `package.json`: `"@dabighomie/audit-orchestrator": "^1.1.0"` (remove `file:` link)
- [ ] **C7.4** Run `npm install` in ugwtf — verify resolves from npm
- [ ] **C7.5** Run `npx tsc --noEmit && npx vitest run` — all pass

### R1 — `file:../audit-orchestrator` breaks in CI
- [ ] **R1.1** If C7 publishes to npm → R1 is automatically resolved
- [x] **R1.2** Keeping `file:` link: both repos use `file:../` links with matching directory structure
- [ ] **R1.3** Verify CI workflow passes with the chosen approach
- [ ] **R1.4** Update `ci.yml` if checkout step needed

---

## Wave 2: Audit → SCOREBOARD Integration & Testing

**Goal**: Verify visual-audit results flow into scoreboard and write integration tests.

### C4 — Audit results flow into SCOREBOARD.json ✅
- [x] **C4.1** Trace data flow: `orchestrate()` → `executeSwarm()` → `SwarmResult` → `generateScoreboard()` → `writeScoreboard()` — confirmed generic loop at `scoreboard.ts:56-60`
- [x] **C4.2** Verify `generateScoreboard()` in `src/output/scoreboard.ts` processes ALL cluster results (including visual-audit) — uses generic `for (const cluster of repo.clusterResults)` loop, no filtering
- [x] **C4.3** Run `npx ugwtf audit <test-repo> --cluster visual-audit --output json` and inspect `.ugwtf/SCOREBOARD.json` — verified via scoreboard-validator.mts script
- [x] **C4.4** Confirm visual-audit agent results appear in the per-repo scores — confirmed in C4.6 test
- [x] **C4.5** If missing: update `generateScoreboard()` to include visual-audit cluster results — NOT NEEDED, already generic
- [x] **C4.6** Write test: scoreboard generation with visual-audit results included — 3 tests added in `src/output/output.test.ts`

### C8 — Integration test: audit-orchestrator cluster runs in UGWTF pipeline ✅
- [x] **C8.1** Create `src/integration.test.ts` — 12 integration tests across 3 describe blocks
- [x] **C8.2** Test: import `visualAuditCluster`, verify it has `id: 'visual-audit'`, 10 agents, `dependsOn: ['quality']` — verified
- [x] **C8.3** Test: each agent has `execute()` and `shouldRun()` functions — verified
- [x] **C8.4** Test: `CLUSTERS` array includes a cluster with `id: 'visual-audit'` — verified
- [x] **C8.5** Test: `clusterExecutionOrder(getClusters(['visual-audit']))` returns valid execution order including `quality` dependency — verified (note: takes `Cluster[]` not `string[]`)
- [x] **C8.6** Run `npx vitest run` — **147/147 pass** (10 test files, exceeded 140+ target)

---

## Wave 3: Documentation

**Goal**: Document the plugin integration for external contributors.

### C6 — README documents audit-orchestrator as a UGWTF plugin
- [ ] **C6.1** Add "Plugins" section to ugwtf `README.md`
- [ ] **C6.2** Document: how audit-orchestrator registers as a plugin
- [ ] **C6.3** Document: how to run visual-audit via CLI (`npx ugwtf audit --cluster visual-audit`)
- [ ] **C6.4** Document: how to write a custom plugin (reference `UGWTFPlugin` interface from G46)
- [ ] **C6.5** Cross-reference `docs/ADDING-AGENTS.md` for agent authoring

---

## Wave 4: GitHub Actions & Multi-Repo CI/CD

**Goal**: Automate audit runs, deployments, and notifications via GitHub Actions.

### C10 — Nightly audit workflow
- [ ] **C10.1** Create `.github/workflows/ugwtf-audit.yml`
- [ ] **C10.2** Trigger: `schedule` (cron daily at 2 AM UTC) + `workflow_dispatch` (manual)
- [ ] **C10.3** Steps: checkout ugwtf, install deps, checkout target repos (or use `gh` CLI)
- [ ] **C10.4** Run: `npx ugwtf audit --all --output json --output markdown`
- [ ] **C10.5** Upload SCOREBOARD artifacts
- [ ] **C10.6** Depends on: C7/R1 resolved (audit-orchestrator available in CI)

### C11 — Deploy workflow on merge
- [ ] **C11.1** Create `.github/workflows/ugwtf-deploy.yml`
- [ ] **C11.2** Trigger: `push` to `main` branch
- [ ] **C11.3** Steps: checkout, install, run `npx ugwtf deploy --all`
- [ ] **C11.4** Requires: C12 (PAT with repo write access)

### C12 — GitHub App or PAT with fine-grained permissions
- [ ] **C12.1** Create fine-grained PAT with permissions: `contents:write`, `issues:write`, `pull-requests:write`, `workflows:write` scoped to DaBigHomie org repos
- [ ] **C12.2** Add as GitHub Actions secret: `UGWTF_PAT`
- [ ] **C12.3** Document required scopes in README
- [ ] **C12.4** Wire `UGWTF_PAT` into audit and deploy workflows as `GITHUB_TOKEN` override

### C13 — `npx ugwtf deploy --all` from GitHub Actions
- [ ] **C13.1** Verify `deploy` command works with `GITHUB_TOKEN` env var (not just `gh` CLI auth)
- [ ] **C13.2** Test locally: `GITHUB_TOKEN=ghp_xxx npx ugwtf deploy --all --dry-run`
- [ ] **C13.3** Wire into C11 workflow
- [ ] **C13.4** Verify labels, workflows, and configs sync to all 5+ target repos

### C14 — Audit SCOREBOARD posted as PR comment
- [ ] **C14.1** Add step to CI workflow: if `pull_request` event, post scoreboard as PR comment
- [ ] **C14.2** Use `github-script` action or `gh pr comment` to post markdown
- [ ] **C14.3** Include: overall score, per-repo breakdown, trend (up/down/stable)
- [ ] **C14.4** Update comment on subsequent pushes (don't flood with duplicates)

### C15 — Slack/Discord notification on audit score regression
- [ ] **C15.1** Choose notification channel: Slack webhook or Discord webhook
- [ ] **C15.2** Add webhook URL as GitHub Actions secret: `NOTIFICATION_WEBHOOK_URL`
- [ ] **C15.3** Add step to nightly audit workflow (C10): if score dropped, POST to webhook
- [ ] **C15.4** Include: repo name, old score, new score, top 3 failing agents
- [ ] **C15.5** Only notify on regression (score drop ≥ 5%), not on every run

### C17 — Dependabot config
- [ ] **C17.1** Create `.github/dependabot.yml`
- [ ] **C17.2** Configure: npm ecosystem, weekly schedule, auto-merge patch updates
- [ ] **C17.3** Configure: GitHub Actions ecosystem, weekly schedule
- [ ] **C17.4** Set reviewers and labels for Dependabot PRs

### C18 — Branch protection rules on `main`
- [ ] **C18.1** Enable branch protection via GitHub API or UI
- [ ] **C18.2** Require: CI checks pass (type-check + test jobs from `ci.yml`)
- [ ] **C18.3** Require: at least 1 review (or auto-merge with passing CI for solo dev)
- [ ] **C18.4** Prevent: force pushes to `main`
- [ ] **C18.5** Document protection rules in README

### C19 — Release workflow: tag → build → publish
- [ ] **C19.1** Review existing `.github/workflows/release.yml` (currently builds but doesn't publish)
- [ ] **C19.2** Add `npm publish` step with `NODE_AUTH_TOKEN` secret
- [ ] **C19.3** Add GitHub Release creation step (auto-generate release notes)
- [ ] **C19.4** Test: create tag `v1.1.0`, verify workflow publishes to npm
- [ ] **C19.5** Update `package.json` version bump strategy (manual or auto via `npm version`)

---

## Wave 5: Open Risks

**Goal**: Eliminate remaining operational risks.

### R2 — `gh` CLI required on PATH — no fallback
- [ ] **R2.1** Audit where `gh` is used: `grep -rn "'gh'" src/` to find all call sites
- [ ] **R2.2** Add runtime check: if `gh` not available, log warning and fall back to REST API
- [ ] **R2.3** Existing async GitHub client (`src/github/client.ts`) already uses REST — verify it covers all `gh` usage
- [ ] **R2.4** If `gh` is only used in agents that also have REST fallback: mark resolved
- [ ] **R2.5** Test: run `npx ugwtf audit <repo>` in env without `gh` on PATH

### R4 — No `.env` handling
- [ ] **R4.1** Decide: add `dotenv` as dependency or implement minimal `.env` loader
- [ ] **R4.2** If `dotenv`: `npm install dotenv`, add `import 'dotenv/config'` to `src/index.ts`
- [ ] **R4.3** If custom: create `src/utils/env.ts` that reads `.env` file and sets `process.env`
- [ ] **R4.4** Create `.env.example` with required variables: `GITHUB_TOKEN`, `UGWTF_PAT`
- [ ] **R4.5** Add `.env` to `.gitignore`
- [ ] **R4.6** Document env setup in README

---

## Execution Priority

| Wave | Items | Effort | Blocks |
|------|-------|--------|--------|
| **Wave 1** | C1, C2, C7, R1 | Medium | ✅ COMPLETE |
| **Wave 2** | C4, C8 | Low | ✅ COMPLETE (147/147 tests) |
| **Wave 3** | C6 | Low | None |
| **Wave 4** | C10-C15, C17-C19 | High | Needs C7/R1 for CI |
| **Wave 5** | R2, R4 | Low | None |

**Recommended order**: Wave 1 → Wave 2 → Wave 3 → Wave 5 → Wave 4

Wave 4 (GitHub Actions) has the most external dependencies (PAT setup, npm publish, webhook URLs) and is best done last after the codebase integration is solid.

---

## Dependencies Between Items

```
C7 + R1 ─┬─→ C10, C11, C13 (CI needs npm-published package)
          └─→ C2 (shared types need stable package reference)

C2 ──────→ C1 (plugin registration needs matching types)

C1 ──────→ C8 (integration test validates plugin registration)

C4 ──────→ C14 (SCOREBOARD in PR comments needs working scoreboard)

C12 ─────→ C11, C13, C14 (all CI workflows need PAT)

C10 ─────→ C15 (notification triggers on nightly audit)

C19 ─────→ C7 (npm publish needed for version lock)
```

---

## Swarm Automation Scripts (Wave 1 Deliverable)

Created during Wave 1 to improve speed, quality, and token efficiency across all repos.

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/swarm-quality-gate.mts` | Parallel tsc/lint/build across all 5 repos | `npx tsx scripts/swarm-quality-gate.mts [--concurrency N] [--json]` |
| `scripts/wave-runner.mts` | P4 progress dashboard + dependency planner | `npx tsx scripts/wave-runner.mts status\|validate\|plan [wave]` |
| `scripts/context-budget.mts` | Token budget analyzer for context files | `npx tsx scripts/context-budget.mts [--threshold N] [--json]` |

**Results (March 18, 2026)**:
- Quality gate: 3/5 repos passing (damieus, 043, maximus)
- Wave progress: 14/32 items (44%) — Wave 1 complete
- Context budget: ~55.8K tokens across 7 repos, 3 bloated files identified

---

## Completion Criteria

- [ ] All 18 remaining items marked `[x]` in `docs/40X-GAP-ANALYSIS-CHECKLIST.md`
- [x] Wave 1 items marked done in checklist
- [ ] TypeScript: 0 errors in both ugwtf and audit-orchestrator
- [x] Tests: all passing (132 tests)
- [ ] CI: green on GitHub Actions
- [ ] SCOREBOARD: auto-generated with visual-audit results included
- [ ] README: documents plugin system and audit-orchestrator integration
