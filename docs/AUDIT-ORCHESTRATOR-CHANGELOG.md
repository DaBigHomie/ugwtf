# Changelog — @dabighomie/audit-orchestrator

## [1.1.0] — 2026-03-13

### Added — Phase 2: UGWTF Integration
- `src/agent.ts` — UGWTF Agent adapter wrapping all 10 audit rules as UGWTF agents
- `src/cluster.ts` — `visual-audit` cluster definition with DAG dependency edges
- `src/prompt-scanner.ts` — Format A prompt scanner (`.github/prompts/*.prompt.md`)
- `--cluster <id>` CLI flag for single-cluster audit mode (dual audit)
- UGWTF-compatible `shouldRun()` guard checking repo framework support

### Fixed
- `findFiles()` crash when called with a file path instead of directory (ENOTDIR)

## [1.0.1] — 2026-03-13

### Fixed
- **BUG-001: ENOTDIR crash in `findFiles()`**
  - **Root cause**: `button-consistency` rule called `countMatches(filePath)`
    where `filePath` was a single `.tsx` file, not a directory.
    `countMatches()` delegates to `findFiles()` which called `readdirSync()`
    on the file path, throwing `ENOTDIR`.
  - **Trigger**: Only occurred when scanning Vite-React projects (`damieus-com-migration`)
    where `resolveComponents()` resolved to `src/components/ui` containing `button.tsx`.
    The `buttonPaths` array matched that file, then passed it to `countMatches()`.
  - **Fix**: Added `stat.isDirectory()` guard at top of `findFiles()`. If given a file
    path, returns `[filePath]` if the extension matches, otherwise `[]`.
  - **File**: `src/scanner.ts` lines 13-17
  - **Verified**: CLI now works against both Next.js and Vite-React projects

## [1.0.0] — 2026-03-13

### Added — Phase 1: Extract & Package
- 10 audit rules extracted from monolithic `audit-orchestrator.mts`
- 3 reporters: terminal, JSON, markdown
- 2 framework adapters: Next.js App Router, Vite-React
- Auto-detection of framework from config files / package.json
- CLI entry point with `parseArgs` (zero dependencies)
- 32 issue catalog with severity + category tagging
- 9 prompt clusters across 4 execution waves
- Parallel execution map renderer

### Verified Against
| Repo | Framework | Completion | Issues |
|------|-----------|------------|--------|
| one4three-co-next-app | nextjs | 42% | 32 |
| damieus-com-migration | vite-react | 27% | 32 |
