# @dabighomie/audit-orchestrator

Portable visual audit CLI for web projects. Checks dark mode, accessibility, design system compliance, mobile responsiveness, and more.

Zero runtime dependencies. Works with Next.js and Vite + React out of the box.

## Quick Start

```bash
npx @dabighomie/audit-orchestrator
```

## Installation

```bash
npm install -D @dabighomie/audit-orchestrator
```

## CLI Usage

```bash
# Audit current directory (terminal output)
audit-orchestrator

# Target a different directory
audit-orchestrator --cwd ../my-project

# JSON output
audit-orchestrator --json
audit-orchestrator --json -o results.json

# Markdown report
audit-orchestrator --markdown
audit-orchestrator --markdown -o REPORT.md

# Filter by cluster
audit-orchestrator --cluster dark-mode

# Verbose (include descriptions and file lists)
audit-orchestrator --verbose

# Show parallel execution map
audit-orchestrator --parallel-map
```

## Audit Rules (10)

| Rule | Category | Severity | What it checks |
|------|----------|----------|----------------|
| Dark Mode Variables | dark-mode | critical | CSS custom properties for theme switching |
| Dark Mode Toggle | dark-mode | high | Toggle component in UI |
| System Preference | dark-mode | medium | `prefers-color-scheme` media query |
| Dark Mode Coverage | dark-mode | high | % of components with dark mode classes |
| Persist Preference | dark-mode | medium | localStorage/cookie for theme choice |
| Layout Shift | layout | high | Elements causing CLS |
| Mobile Breakpoints | mobile | high | Responsive breakpoint coverage |
| Missing Alt Text | accessibility | critical | Images without alt attributes |
| Touch Targets | mobile | medium | Minimum 44x44px touch targets |
| Color Contrast | accessibility | critical | WCAG AA contrast ratios |

## Supported Frameworks

| Framework | Adapter | Auto-detected via |
|-----------|---------|-------------------|
| Next.js | `nextjs` | `next.config.*` in root |
| Vite + React | `vite-react` | `vite.config.*` + React dependency |

## Clusters

Rules are grouped into execution clusters that can run in parallel:

- **dark-mode** — Theme variable, toggle, system preference, coverage, persistence
- **layout** — Layout shift detection
- **mobile** — Breakpoints, touch targets
- **accessibility** — Alt text, color contrast

## Output Formats

### Terminal (default)
Color-coded table with pass/fail/skip status per rule.

### JSON (`--json`)
Machine-readable output for CI pipelines:
```json
{
  "totalIssues": 32,
  "bySeverity": { "critical": 5, "high": 14, "medium": 12, "low": 1 },
  "byCategory": { "dark-mode": 5, "layout": 5, ... },
  "overallCompletion": 42,
  "framework": "nextjs",
  "clusters": [...],
  "issues": [...]
}
```

### Markdown (`--markdown`)
Report suitable for PR comments or documentation.

## GitHub Actions

Add to your repo's `.github/workflows/visual-audit.yml`:

```yaml
name: Visual Audit
on:
  pull_request:
    paths: ['src/**', 'app/**', '*.tsx', '*.css']

permissions:
  contents: read
  pull-requests: write

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npx @dabighomie/audit-orchestrator --json -o audit-results.json
      - name: Post PR Comment
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('audit-results.json', 'utf8'));
            const icon = (n) => n === 0 ? '✅' : n <= 2 ? '⚠️' : '❌';
            const body = `## Visual Audit Results
            | Metric | Value |
            |--------|-------|
            | Total Issues | ${results.totalIssues} |
            | Critical | ${icon(results.bySeverity.critical)} ${results.bySeverity.critical} |
            | High | ${icon(results.bySeverity.high)} ${results.bySeverity.high} |
            | Completion | ${results.overallCompletion}% |
            | Framework | ${results.framework} |`;
            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner, repo: context.repo.repo,
              issue_number: context.issue.number,
            });
            const existing = comments.find(c => c.body?.includes('## Visual Audit Results'));
            if (existing) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner, repo: context.repo.repo,
                comment_id: existing.id, body,
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner, repo: context.repo.repo,
                issue_number: context.issue.number, body,
              });
            }
```

## UGWTF Integration

This package integrates with [`@dabighomie/ugwtf`](https://github.com/DaBigHomie/ugwtf) for multi-repo orchestration:

```bash
# Deploy visual-audit workflow to all registered repos
cd ugwtf && npx tsx src/index.ts deploy --cluster visual-audit

# Run audit as part of full audit
npx tsx src/index.ts audit 043
```

### Programmatic API

```typescript
// Agent adapter (for UGWTF integration)
import { visualAuditCluster } from '@dabighomie/audit-orchestrator/cluster';

// Prompt scanner (scan .prompt.md files for audit tasks)
import { scanPromptFiles } from '@dabighomie/audit-orchestrator/prompt-scanner';
```

## Multi-Repo Test Results

Tested against 4 production repos:

| Repo | Framework | Issues | Completion |
|------|-----------|--------|------------|
| one4three-co-next-app | nextjs | 32 | 42% |
| damieus-com-migration | vite-react | 32 | 27% |
| flipflops-sundays-reboot | vite-react | 32 | 24% |
| maximus-ai | nextjs | 32 | 7% |

## Requirements

- Node.js ≥ 18.3.0
- TypeScript ≥ 5.7.0 (dev only)

## License

MIT
