---
applyTo: "**"
---

# Commit & Quality Gate Rules

> Managed by DaBigHomie/documentation-standards — do not edit in target repos.

## Branch Safety Rules (MANDATORY)

1. **Create a new branch** before editing code — never commit directly to `main` or another agent's branch
2. **Verify branch** before every commit: run `git branch --show-current` and confirm it matches your working branch
3. **Never delete a branch you didn't create** — only delete branches you explicitly created with `git checkout -b`
4. If you committed to the wrong branch, cherry-pick to the correct branch and reset the wrong one — do NOT delete it

## Pre-Commit Steps (MANDATORY)

1. `git branch --show-current` — verify correct branch
2. `npx tsc --noEmit` — 0 errors
3. `npm run lint` — 0 errors
4. `npm run build` — succeeds
5. **`npm run build 2>&1 | grep -Ei "warning|error|deprecated|Unexpected|Parsing CSS"` — 0 warnings** ⭐ CRITICAL
6. Test in browser if UI changes
7. Workflow files: NO `${{ }}` syntax in comments
8. Ask user to review before committing
9. `git status` then `git add -A` then `git status --short` then commit

## Build Output Rules (MANDATORY)

- **NEVER use `tail`** to read build output — warnings appear in the MIDDLE of output, not at the end
- **NEVER assume exit code 0 means clean** — frameworks can succeed with CSS/optimization warnings
- **ALWAYS grep the FULL build output** for: `warning`, `error`, `deprecated`, `Unexpected`, `Parsing CSS`

## Commit Format

**Short**: `feat/fix/docs: [description]`

**Multi-line** — use heredoc (never `-m` with line breaks):
```bash
git commit -F - <<'EOF'
feat: Description

Testing Evidence:
- TypeScript: 0 errors
- Build: Successful
EOF
```

**Never**: `git reset`, `git commit -a` (doesn't stage untracked files)

## Pre-Deployment Quality Gates

| Gate | Command | Must Pass |
|------|---------|-----------|
| TypeScript | `npx tsc --noEmit` | 0 errors |
| Lint | `npm run lint` | 0 errors |
| Build | `npm run build` | Success |
| Unit Tests | `npm test -- --run` | All pass |
| E2E | `npx playwright test` | All pass |

NEVER deploy if any gate fails.

## Terminal Output Rules

- **NEVER use `tail` to check build/test output** — critical warnings appear mid-output, not at the end
- Read ALL output — never ignore warnings, deprecation notices, or errors
- ALWAYS grep full output for warning patterns — don't rely on exit codes alone
- Never proceed if: build failed, type errors, test failures, CSS warnings, security vulnerabilities
- Escalate to user if: unknown errors, conflicting messages, cannot determine root cause
