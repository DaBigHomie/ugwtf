# UGWTF — Script Purpose Index

All scripts in `scripts/`. Run with `npx tsx scripts/<name>.mts`.

## Scripts

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `advance-chain.mts` | Advance prompt chain to next step; marks completed, triggers next | After completing a prompt step |
| `audit-all.mts` | Run full audit across all registered repos | Weekly health checks |
| `cluster-test-runner.mts` | Run tests scoped to a specific cluster | Validate single cluster changes |
| `context-analyzer.mts` | Analyze repo context size (files, tokens) | Before agent runs to estimate load |
| `context-budget.mts` | Calculate token budget for agent contexts | Tuning concurrency/batch sizes |
| `create-chain-issues.mts` | Create GitHub issues from prompt-chain.json | Bootstrap issue tracking from chain |
| `doc-manager.mts` | Manage documentation lifecycle (create, update, archive) | Documentation maintenance |
| `doc-sync-validator.mts` | Validate cross-references between docs | Ensure doc links aren't broken |
| `scoreboard-validator.mts` | Validate scoreboard JSON integrity | After audit to verify output |
| `swarm-quality-gate.mts` | Run quality gate checks as swarm pre-flight | Before swarm execution |
| `wave-runner.mts` | Execute prompt chain waves (batches of parallel prompts) | Orchestrated prompt execution |

## npm Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `build` | `tsc` | Compile TypeScript to dist/ |
| `dev` | `tsx watch src/index.ts` | Dev mode with file watching |
| `deploy` | `tsx src/index.ts deploy` | Deploy workflows to repos |
| `validate` | `tsx src/index.ts validate` | Run quality gates |
| `fix` | `tsx src/index.ts fix` | Auto-fix issues |
| `labels` | `tsx src/index.ts labels` | Sync labels |
| `chain:folder:verify` | `tsc --noEmit && vitest run && tsx src/index.ts generate-chain --dry-run --verbose --no-cache` | **Generic**: verify prompts in any folder — pass `-- <repo> --path <folder>` |
| `chain:folder:run` | `tsx src/index.ts chain` | **Generic**: execute chain for any repo — pass `-- <repo> --verbose` |
| `dogfood:setup` | `tsx scripts/generate-publish-chain.mts` | Self-publish: generate 40 prompts + chain config |
| `dogfood:verify` | `tsc + vitest + chain dry-run + generate-chain dry-run (ugwtf, publish-chain)` | Self-publish: full validation (hardcoded) |
| `dogfood:execute` | `tsx src/index.ts chain ugwtf --verbose` | Self-publish: create/advance issues |
| `dogfood:full` | `npm run dogfood:setup && npm run dogfood:verify` | Self-publish: setup + verify combined |
| `publish:verify` | `npm run build && npm publish --dry-run` | Verify package readiness before publish |
| `type-check` | `tsc --noEmit` | TypeScript validation only |
| `test` | `vitest run` | Run all tests |
| `test:watch` | `vitest` | Tests in watch mode |
| `test:coverage` | `vitest run --coverage` | Tests with coverage report |
| `lint` | `eslint src/` | ESLint check |
| `prepublishOnly` | `npm run build` | Build before npm publish |

## Generators (src/generators/)

These generate YAML/config files deployed to target repos:

| Generator | Output | Purpose |
|-----------|--------|---------|
| `ci-workflow.ts` | `.github/workflows/ci.yml` | Standard CI pipeline |
| `copilot-automation.ts` | `.github/workflows/copilot-*.yml` | 8-phase Copilot approval pipeline |
| `prompt-chain-workflow.ts` | `.github/workflows/prompt-chain.yml` | Prompt chain execution workflow |
| `dependabot-auto-merge.ts` | `.github/workflows/dependabot-*.yml` | Auto-merge Dependabot PRs |
| `security-audit.ts` | `.github/workflows/security-audit.yml` | Security scanning workflow |
| `supabase-migration.ts` | `.github/workflows/supabase-*.yml` | Migration safety workflow |
| `visual-audit.ts` | `.github/workflows/visual-audit.yml` | Visual regression workflow |
