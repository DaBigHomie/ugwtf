---
applyTo: "scripts/**/*.mts"
---

# Script Automation Standards

## TypeScript Scripts (.mts)

All automation scripts in `scripts/` MUST:

1. **Use `.mts` extension** — ESM TypeScript, executed via `npx tsx`
2. **Use `node:` protocol imports** — `import { existsSync } from "node:fs"`
3. **Include CLI flags** — At minimum `--dry-run` and `--verbose`
4. **Use colored output** — ANSI escape codes for ✅/❌/⚠️ status
5. **Exit with proper codes** — `process.exitCode = 1` on errors, not `process.exit(1)`
6. **No hardcoded paths** — Derive from `import.meta.url` using `fileURLToPath`

## Sync Workflow

The sync pipeline runs automatically via post-commit hook:

```
Management/.github/ (source of truth)
    ↓ post-commit hook
    ↓ npx tsx scripts/sync-to-workspace.mts
management-git/.github/ (workspace root — VS Code reads here)
```

To install the hook: `git config core.hooksPath .githooks`
To run manually: `npx tsx scripts/sync-to-workspace.mts`
To preview: `npx tsx scripts/sync-to-workspace.mts --dry-run`
