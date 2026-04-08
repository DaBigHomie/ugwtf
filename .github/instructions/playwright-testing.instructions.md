---
applyTo: "**/e2e/**,**/tests/e2e/**,**/specs/**,**/*.spec.ts,**/packages/test-30x/**"
---

# Playwright Testing Knowledge

> Auto-loaded when any agent opens or references E2E test files.

## Locator Best Practices

**Priority order** (most stable → least stable):
1. `getByRole()` — button, link, heading, textbox
2. `getByLabel()` — form inputs with labels
3. `getByText()` — visible text content
4. `getByTestId()` — `data-testid` attributes
5. CSS `[data-testid="..."]` — selector fallback
6. CSS `.class` — last resort only

**Never**: fragile paths like `div > span:nth-child(3)`, dynamic IDs like `#react-123`.

## Wait Strategies

```typescript
// Wait for element visibility
await page.getByRole('button', { name: 'Submit' }).waitFor({ state: 'visible', timeout: 10000 });

// Wait for navigation
await page.waitForURL('**/checkout/success');

// Wait for network
await page.goto('/shop', { waitUntil: 'networkidle' });

// Wait for API response
await page.waitForResponse(resp => resp.url().includes('/api/products') && resp.status() === 200);
```

## Trace Debugging

```bash
# Generate trace on failure
npx playwright test --trace on

# View trace interactively
npx playwright show-trace test-results/<test-name>/trace.zip

# Run in debug mode (step-through)
npx playwright test --debug
```

## Repo-Specific Test Commands

| Repo | Primary | Secondary | Config |
|------|---------|-----------|--------|
| damieus-com-migration | `npm run test:devtools` | `npx playwright test` | `playwright.config.ts` |
| one4three-co-next-app | `npm run test:e2e` | `npx playwright test e2e/specs/route-health.spec.ts` | `playwright.config.ts` |
| flipflops-sundays-reboot | `npx playwright test` | — | `playwright.config.ts` |
| maximus-ai | `npx playwright test` | — | `playwright.config.ts` |
| e2e-20x | `npm run test:layer2` | `npm run test:critical` | `playwright.config.ts` (3 projects) |

## e2e-20x Framework (Layer System)

| Layer | Purpose | Scripts |
|-------|---------|---------|
| 0 — Scan | Discover repos and test targets | `npm run scan:repos` |
| 1 — Discover | Map routes, find endpoints | `npm run discover:routes` |
| 2 — Validate | Run Playwright E2E tests | `npm run test:layer2`, `npm run test:critical` |
| 3 — Regression | Track regressions over time | `npm run test:regression` |

**3 browser projects**: `chromium`, `mobile-safari`, `firefox`

## Common Flakiness Patterns

### Race Condition with Animations
Add explicit waits after triggering CSS/Framer Motion animations. Default animation durations: 200-500ms.

### Supabase Auth in Tests
Tests hitting Supabase may fail if auth tokens expire. Use `page.context().addCookies()` or mock auth state.

### Stripe Iframe Testing (flipflops-sundays-reboot)
Stripe elements render in iframes. Use:
```typescript
page.frameLocator('[data-testid="card-number"] iframe');
```
Not: `iframe[name*="stripe"]` (incorrect — Stripe iframes don't have "stripe" in the name attribute).

## Helper Utilities (e2e-20x)

```typescript
import { collectConsoleErrors, collectNetworkFailures } from '../fixtures/helpers';

// In test setup
const errors = await collectConsoleErrors(page);
const failures = await collectNetworkFailures(page);
```

## Test File Conventions

- Spec files: `*.spec.ts`
- Fixture files: `e2e/fixtures/*.ts`
- Page objects: `e2e/pages/*.ts` (if present)
- Helpers: `e2e/fixtures/helpers.ts`
