# UGWTF — Test Coverage

**Framework**: Vitest 3.2.4  
**Total**: 261 tests across 15 files  
**Status**: All passing  
**Coverage threshold**: 60% lines

## Test Files

| File | Tests | What It Covers |
|------|-------|---------------|
| `src/agents/prompt-agents.test.ts` | 54 | 12-point validatePrompt scoring, parseDependencies, scanAllPrompts, agent metadata |
| `src/index.test.ts` | 64 | CLI parseArgs, command dispatch, flag handling |
| `src/monorepo.test.ts` | 36 | Multi-repo operations, orchestration |
| `src/agents/chain-agents.test.ts` | 11 | Chain generator pipeline, Format B chaining |
| `src/utils/common.test.ts` | 14 | Shared utility functions |
| `src/clusters/clusters.test.ts` | 11 | Cluster registry, agent registration |
| `src/integration.test.ts` | 12 | Cross-module integration |
| `src/clients/github.test.ts` | 2 | Octokit wrapper |
| `src/utils/logger.test.ts` | 6 | Logging utilities |
| + 6 more files | ~51 | Various modules |

## Running Tests

```bash
# All tests
npx vitest run

# Single file
npx vitest run src/agents/prompt-agents.test.ts

# Watch mode
npx vitest

# With coverage
npx vitest run --coverage
```

## Test Fixtures

Location: `tests/fixtures/test-repo/`

```
test-repo/
├── .github/prompts/
│   └── setup-linting.prompt.md         # Format A (YAML frontmatter)
├── docs/prompts/feature-improvements/
│   ├── 01-setup-foundation.prompt.md   # Format B, P0, 2h
│   ├── 02-database-schema.prompt.md    # Format B, P0, 3h
│   ├── 03-auth-integration.prompt.md   # Format B, P1, 4h
│   ├── 04-api-routes.prompt.md         # Format B, P1, 3h
│   ├── 05-dashboard-ui.prompt.md       # Format B, P2, 6h
│   ├── 06-email-notifications.prompt.md # Format B, P2, 2h
│   └── 07-e2e-testing.prompt.md        # Format B, P3, 4h
└── scripts/
    └── prompt-chain.json               # Expected chain output
```

## Coverage Gaps (Known)

| Gap | Severity | Notes |
|-----|----------|-------|
| Agent execute() methods | Medium | Most agents tested via integration, not unit |
| Generator output YAML | Low | Generators produce static templates |
| Plugin loader | Low | Extensibility feature, not yet used |

## Test Patterns

All test files follow the same pattern:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Fixture path
const FIXTURES_DIR = join(import.meta.dirname, '../../tests/fixtures/test-repo');

// Mock GitHub client
vi.mock('../clients/github.js', () => ({
  getRepo: vi.fn().mockResolvedValue({ owner: 'test', name: 'repo', octokit: {} })
}));

// Helper to build AgentContext
function makeCtx(overrides = {}): AgentContext {
  return { repo: { owner: 'test', name: 'repo', path: FIXTURES_DIR }, ... };
}
```
