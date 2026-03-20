# UGWTF — CLI Reference

## Usage

```bash
npx tsx src/index.ts <command> [repos...] [flags]
```

If built: `ugwtf <command> [repos...] [flags]`

## Commands

### Operational

| Command | Args | Description |
|---------|------|-------------|
| `labels <repos>` | repo aliases | Sync label definitions to GitHub |
| `deploy <repos>` | repo aliases | Labels + deploy CI/CD workflow YAML |
| `validate <repos>` | repo aliases | Run quality gates (tsc, lint, build) |
| `issues <repos>` | repo aliases | Triage, stalled detection, Copilot assign |
| `prs <repos>` | repo aliases | Review Copilot PRs, DB migration firewall |
| `audit <repos>` | repo aliases | Full health audit + scoreboard (target 80%+) |
| `fix <repos>` | repo aliases | Auto-fix labels, workflows, quality |
| `status <repos>` | repo aliases | Quick health snapshot |

### Generation

| Command | Args | Description |
|---------|------|-------------|
| `generate-chain <repos>` | repo aliases | Build prompt execution chain from docs/ |

### Utility

| Command | Args | Description |
|---------|------|-------------|
| `list` | — | List all agents and clusters |
| `scaffold-agent` | — | Generate new agent boilerplate |
| `scaffold-repo` | — | Register new repo |

## Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--dry-run` | boolean | false | Preview changes without executing |
| `--verbose`, `-v` | boolean | false | Debug output |
| `--concurrency` | number | 3 | Max parallel repos |
| `--cluster` | string | — | Target specific cluster (repeatable) |
| `--path` | string | — | Scope prompt scanning to path (generate-chain) |
| `--no-cache` | boolean | false | Disable repo unchanged-skip cache |
| `--output` | string | — | Report format: json\|markdown\|summary |

## Repo Aliases

Repos are registered in `src/config/repo-registry.ts`:

| Alias | GitHub Repo | Supabase ID |
|-------|-------------|-------------|
| `damieus` | DaBigHomie/damieus-com-migration | okonslamwxtcoekuhmtm |
| `043` | DaBigHomie/one4three-co-next-app | bgqjgpvzokonkyiljasj |
| `ffs` | DaBigHomie/flipflops-sundays-reboot | tyeusfguqqznvxgloobb |
| `cae` | DaBigHomie/cae-luxury-hair | — |
| `maximus` | DaBigHomie/maximus-ai | ycqtigpjjiqhkdecwiqt |

## Examples

```bash
# Sync labels to one repo
npx tsx src/index.ts labels damieus

# Audit all repos (dry run)
npx tsx src/index.ts audit damieus 043 ffs cae maximus --dry-run -v

# Generate prompt chain for damieus
npx tsx src/index.ts generate-chain damieus --output chain.json

# Fix all issues in flipflops
npx tsx src/index.ts fix ffs

# Weekly maintenance (all repos)
npx tsx src/index.ts deploy damieus 043 ffs cae maximus && \
npx tsx src/index.ts issues damieus 043 ffs cae maximus && \
npx tsx src/index.ts prs damieus 043 ffs cae maximus && \
npx tsx src/index.ts validate damieus 043 ffs cae maximus && \
npx tsx src/index.ts audit damieus 043 ffs cae maximus
```
