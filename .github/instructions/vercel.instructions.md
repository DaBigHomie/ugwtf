---
applyTo: "**/.vercel/**,**/vercel.json"
---

# Vercel Multi-Account Management (Workspace-Level)

> Multiple repos in this workspace deploy to DIFFERENT Vercel accounts.
> This file prevents scope confusion across projects.

## Account-to-Project Mapping

| Repository | Vercel Account | Vercel Scope | Project Name | Production URL |
|------------|---------------|--------------|--------------|----------------|
| `one4three-co-next-app` | **Jay Anthony** | *(separate login)* | one4three-co-next-app | one4three.co |
| `maximus-ai` | Dame Luthas | `dame-luthas` | maximus-ai | maximus-ai-dame-luthas.vercel.app |
| `cae-luxury-hair` | Dame Luthas | `dame-luthas` | cae-luxury-hair | cae-dame-luthas.vercel.app |
| `flipflops-sundays-reboot` | Dame Luthas | `dame-luthas` | flipflop-sundays-vercel | flipflop-sundays-vercel.vercel.app |
| `damieus-com-migration` | Dame Luthas | `dame-luthas` | — | damieus.com |
| `private-wealth-club-platform` | Dame Luthas | `dame-luthas` | private-wealth-club-platform | damieus.app |

## Pre-Flight Check (MANDATORY)

Before running ANY `vercel` CLI command:

```bash
# 1. Which account am I authenticated as?
vercel whoami

# 2. Which project is linked in this directory?
cat .vercel/project.json 2>/dev/null || echo "Not linked"

# 3. Does the account match the project mapping above?
```

**If `vercel whoami` shows the wrong account for the target project, STOP and switch accounts first.**

## Switching Between Accounts

The Vercel CLI only supports ONE authenticated user at a time. To switch:

```bash
# Log out of current account
vercel logout

# Log into the target account
vercel login

# Confirm
vercel whoami
```

### Quick Switch Pattern

```bash
# Before working on ONE4THREE (Jay Anthony account):
vercel whoami  # if not Jay Anthony → vercel logout && vercel login

# Before working on maximus-ai/cae/ffs (Dame Luthas account):
vercel whoami  # if not dameluthas → vercel logout && vercel login
```

## Linking Projects

```bash
# Navigate to the repo
cd ~/management-git/<repo-name>

# NEVER use --yes (auto-picks wrong scope)
vercel link

# Select the correct scope when prompted
# Verify
cat .vercel/project.json
```

## Adding Environment Variables

```bash
# ALWAYS use interactive mode (no echo piping)
vercel env add VARIABLE_NAME production

# Verify
vercel env ls
```

**NEVER use `echo "value" | vercel env add ...` — this appends a trailing `\n` that silently corrupts the value.**

## Common Mistakes

| Mistake | Consequence | Prevention |
|---------|-------------|------------|
| `vercel link --yes` | Silently links to default scope (Dame Luthas) | Always omit `--yes`, select scope interactively |
| `echo "val" \| vercel env add` | Trailing `\n` corrupts env var value | Use interactive `vercel env add` |
| Pushing env vars without checking `whoami` | Vars land on wrong project | Always run `vercel whoami` first |
| Running `vercel deploy` from wrong account | Deploys to wrong Vercel project | Check `whoami` + `.vercel/project.json` |

## Diagnostic Logging

All Supabase clients in this workspace log structured diagnostics when env vars are missing:

```
[supabase/server] Missing env vars — {"NEXT_PUBLIC_SUPABASE_URL":"UNSET","NEXT_PUBLIC_SUPABASE_ANON_KEY":"UNSET","VERCEL_ENV":"production","VERCEL_URL":"one4three-co-abc123.vercel.app","NODE_ENV":"production"}
```

This appears in **Vercel Function Logs** (Dashboard → Deployments → Functions) and tells you:
- Which var is missing (`UNSET` vs masked value)
- Which Vercel environment (`production`, `preview`, `development`)
- Which deployment URL is affected

## `.vercel/` Directory

- Gitignored by convention — each developer must `vercel link` after cloning
- Contains `project.json` with `projectId`, `orgId`, `projectName`
- If `orgId` doesn't match the expected account for the repo, delete `.vercel/` and re-link
