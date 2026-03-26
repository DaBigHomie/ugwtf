# UGWTF — CLI Reference

## Usage

```bash
node dist/index.js <command> [repos...] [flags]
```

## Commands

### Pipeline

| Command | Args | Description |
|---------|------|-------------|
| `prompts <repos>` | repo aliases | Scan .prompt.md → create spec issues |
| `generate-chain <repos>` | repo aliases | Build prompt-chain.json (toposort + waves) |
| `chain <repos>` | repo aliases | Create chain issues, assign Copilot |
| `issues <repos>` | repo aliases | Triage, stalled detection, Copilot assign |
| `prs <repos>` | repo aliases | Review Copilot PRs, DB migration firewall |
| `cleanup <repos>` | repo aliases | Close orphan PRs, strip labels, re-assign |
| `dry-run <repos>` | repo aliases | E2E validation without side effects |

### Setup & Quality

| Command | Args | Description |
|---------|------|-------------|
| `labels <repos>` | repo aliases | Sync label definitions to GitHub |
| `deploy <repos>` | repo aliases | Labels + deploy CI/CD workflow YAML |
| `install <repos>` | repo aliases | Alias for deploy |
| `validate <repos>` | repo aliases | Run quality gates (tsc, lint, build) |
| `fix <repos>` | repo aliases | Auto-fix labels, workflows, quality |
| `status <repos>` | repo aliases | Quick health snapshot |
| `audit <repos>` | repo aliases | Full health audit + scoreboard |

### Domain Scans

| Command | Description |
|---------|-------------|
| `scan` | Full scan (all domain clusters) |
| `security` | Vulnerability scan + secret detection |
| `performance` | Bundle size + heavy deps |
| `a11y` | Accessibility (WCAG) |
| `seo` | Meta tags, sitemaps |
| `docs` | Documentation coverage |
| `commerce` | E-commerce features |
| `design-system` | Tokens, components, responsive |
| `supabase` | Supabase + FSD compliance |

### Utility

| Command | Description |
|---------|-------------|
| `list` | List all agents and clusters |
| `scaffold-agent` | Generate new agent boilerplate |
| `scaffold-repo` | Register new repo |

## Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--dry-run` | boolean | false | Preview without executing |
| `--verbose`, `-v` | boolean | false | Debug output |
| `--concurrency` | number | 3 | Max parallel repos |
| `--cluster` | string | — | Target specific cluster |
| `--path` | string | — | Scope prompt scanning to path |
| `--no-cache` | boolean | false | Skip repo cache |
| `--output` | string | summary | json, markdown, summary |
| `--max-copilot-concurrency` | number | 1 | Max Copilot issues at once |

## Repo Aliases

| Alias | GitHub Repo |
|-------|-------------|
| `damieus` | DaBigHomie/damieus-com-migration |
| `043` | DaBigHomie/one4three-co-next-app |
| `ffs` | DaBigHomie/flipflops-sundays-reboot |
| `cae` | DaBigHomie/Cae |
| `maximus` | DaBigHomie/maximus-ai |
| `ugwtf` | DaBigHomie/ugwtf |

## Examples

```bash
# Start a chain
node dist/index.js chain 043 --no-cache --verbose

# Validate pipeline without side effects
node dist/index.js dry-run 043 --no-cache

# Reset after failed chain
node dist/index.js cleanup 043 --no-cache --verbose

# Weekly maintenance
node dist/index.js deploy damieus 043 ffs && \
node dist/index.js issues damieus 043 ffs && \
node dist/index.js prs damieus 043 ffs
```
