/**
 * UGWTF Repo Registry
 *
 * Canonical configuration for every repo under the DaBigHomie org.
 * Each entry drives workflow generation, label sync, and bug fixes.
 */

export type Framework = 'vite-react' | 'nextjs' | 'node';

export interface RepoConfig {
  /** GitHub slug: owner/repo */
  slug: string;
  /** Short alias used on CLI */
  alias: string;
  /** Framework determines build commands and workflow tweaks */
  framework: Framework;
  /** Supabase project ID (null = no Supabase) */
  supabaseProjectId: string | null;
  /** Secret env var name for Supabase URL */
  supabaseUrlSecret: string | null;
  /** Secret env var name for Supabase service role key */
  supabaseServiceKeySecret: string | null;
  /** Path to generated Supabase types file */
  supabaseTypesPath: string | null;
  /** Node version used in CI */
  nodeVersion: string;
  /** Default branch */
  defaultBranch: string;
  /** @deprecated Use ci.e2e instead. Whether repo has E2E tests */
  hasE2E: boolean;
  /** @deprecated Use ci.e2e.command instead. E2E command (if hasE2E) */
  e2eCommand: string | null;
  /** Extra labels beyond the universal set */
  extraLabels: LabelDef[];
  /** Absolute local path (for validation / file writing) */
  localPath: string;
  /** If true, `ugwtf install` skips workflow YAML generation for this repo (instructions + labels still sync) */
  skipWorkflowDeploy?: boolean;

  // CI configuration — UGWTF owns the full CI pipeline per repo
  ci: {
    /** Command for linting. null = skip lint step */
    lintCommand: string | null;
    /** Command for type checking. null = skip */
    typeCheckCommand: string | null;
    /** Command for building. null = skip */
    buildCommand: string | null;
    /** Command for unit tests. null = skip */
    unitTestCommand: string | null;
    /** E2E test runner. null = no E2E */
    e2e: {
      command: string;
      /** Install command for browser binaries */
      installCommand: string;
      /** Whether E2E failure should block merge */
      blocking: boolean;
    } | null;
  };
}

export interface LabelDef {
  name: string;
  color: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Universal labels deployed to EVERY repo
// ---------------------------------------------------------------------------
export const UNIVERSAL_LABELS: LabelDef[] = [
  // Priority
  { name: 'priority:p0', color: 'b60205', description: 'Critical — blocking launch' },
  { name: 'priority:p1', color: 'e11d48', description: 'High priority — needed before launch' },
  { name: 'priority:p2', color: 'f97316', description: 'Medium priority — nice to have' },
  { name: 'priority:p3', color: '65a30d', description: 'Low priority — future enhancement' },

  // Automation tiers
  { name: 'automation:copilot', color: '7c3aed', description: 'Copilot can implement autonomously' },
  { name: 'automation:full', color: '6d28d9', description: 'Fully automated workflow' },
  { name: 'automation:partial', color: '8b5cf6', description: 'Agent assists, human decides' },
  { name: 'automation:manual', color: 'a78bfa', description: 'Must be done manually' },
  { name: 'automation:in-progress', color: 'c084fc', description: 'Automation pipeline running' },
  { name: 'automation:completed', color: '22c55e', description: 'Automation completed successfully' },

  // Agent
  { name: 'agent:copilot', color: '2563eb', description: 'Task for GitHub Copilot coding agent' },

  // Status
  { name: 'needs-pr', color: 'fbbf24', description: 'Issue needs PR within 24h' },
  { name: 'stalled', color: 'f59e0b', description: 'Issue stalled without PR' },
  { name: 'needs-review', color: 'fb923c', description: 'Needs manual review' },

  // Category
  { name: 'database', color: '059669', description: 'Database schema or migrations' },
  { name: 'infrastructure', color: '0284c7', description: 'Infrastructure and tooling' },
  { name: 'enhancement', color: 'a3e635', description: 'New feature or enhancement' },
  { name: 'bug', color: 'd73a4a', description: 'Something is not working' },
  { name: 'documentation', color: '0075ca', description: 'Documentation updates' },
  { name: 'dependencies', color: '0366d6', description: 'Dependency updates' },
  { name: 'security', color: 'e4e669', description: 'Security vulnerability' },

  // Merge safety
  { name: 'safe-migration', color: '2da44e', description: 'Migration validated as safe' },
  { name: 'destructive-migration', color: 'b60205', description: 'Migration contains destructive ops' },
  { name: 'types-update', color: '1d76db', description: 'Auto-generated type update' },

  // Naming convention (type prefix for PRs/issues/commits)
  { name: 'type:feat', color: '1d76db', description: 'New feature' },
  { name: 'type:fix', color: 'd73a4a', description: 'Bug fix' },
  { name: 'type:chore', color: 'bfdadc', description: 'Maintenance task' },
  { name: 'type:docs', color: '0075ca', description: 'Documentation change' },
  { name: 'type:refactor', color: 'c5def5', description: 'Code refactoring' },
  { name: 'type:test', color: 'bfd4f2', description: 'Test updates' },
  { name: 'type:ci', color: 'e6e6e6', description: 'CI/CD changes' },

  // Scope labels
  { name: 'scope:ci', color: 'e6e6e6', description: 'CI/CD workflow scope' },
  { name: 'scope:db', color: '059669', description: 'Database scope' },
  { name: 'scope:ui', color: 'f9a8d4', description: 'UI/frontend scope' },
  { name: 'scope:api', color: '0ea5e9', description: 'API scope' },
  { name: 'scope:auth', color: 'f97316', description: 'Authentication scope' },

  // Copilot readiness
  { name: 'copilot:ready', color: '2563eb', description: 'Ready for Copilot assignment' },

  // Issue layers
  { name: 'prompt-spec', color: 'c5def5', description: 'Prompt specification issue' },
  { name: 'chain-tracker', color: 'bfd4f2', description: 'Chain tracking issue' },
  { name: 'prompt-chain', color: '7c3aed', description: 'PR from prompt chain' },
];

// ---------------------------------------------------------------------------
// Per-repo configs — the source of truth
// ---------------------------------------------------------------------------
const HOME = process.env.HOME ?? '~';

export const REPOS: Record<string, RepoConfig> = {
  damieus: {
    slug: 'DaBigHomie/damieus-com-migration',
    alias: 'damieus',
    framework: 'vite-react',
    supabaseProjectId: 'okonslamwxtcoekuhmtm',
    supabaseUrlSecret: 'SUPABASE_URL_DAMIEUS',
    supabaseServiceKeySecret: 'SUPABASE_SERVICE_ROLE_KEY_DAMIEUS',
    supabaseTypesPath: 'src/integrations/supabase/types.ts',
    nodeVersion: '20',
    defaultBranch: 'main',
    hasE2E: true,
    e2eCommand: 'npx playwright test',
    extraLabels: [
      { name: 'ecommerce', color: 'f8b4d9', description: 'Ecommerce feature' },
      { name: 'persona-implementation', color: 'c2185b', description: 'Persona page implementation' },
    ],
    localPath: `${HOME}/management-git/damieus-com-migration`,
    ci: {
      lintCommand: 'eslint .',
      typeCheckCommand: 'tsc --noEmit',
      buildCommand: 'vite build',
      unitTestCommand: 'vitest run',
      e2e: {
        command: 'npx playwright test',
        installCommand: 'npx playwright install --with-deps chromium',
        blocking: false,
      },
    },
  },

  ffs: {
    slug: 'DaBigHomie/flipflops-sundays-reboot',
    alias: 'ffs',
    framework: 'vite-react',
    supabaseProjectId: 'tyeusfguqqznvxgloobb',
    supabaseUrlSecret: 'SUPABASE_URL_FFS',
    supabaseServiceKeySecret: 'SUPABASE_SERVICE_ROLE_KEY_FFS',
    supabaseTypesPath: 'src/integrations/supabase/types.ts',
    nodeVersion: '20',
    defaultBranch: 'main',
    hasE2E: true,
    e2eCommand: 'npx playwright test',
    extraLabels: [
      { name: 'events', color: 'ff6f61', description: 'Event management features' },
      { name: 'checkout', color: '457b9d', description: 'Checkout flow features' },
    ],
    localPath: `${HOME}/management-git/flipflops-sundays-reboot`,
    ci: {
      lintCommand: 'eslint .',
      typeCheckCommand: null,
      buildCommand: 'vite build',
      unitTestCommand: null,
      e2e: {
        command: 'npx playwright test',
        installCommand: 'npx playwright install --with-deps chromium',
        blocking: false,
      },
    },
  },

  '043': {
    slug: 'DaBigHomie/one4three-co-next-app',
    alias: '043',
    framework: 'nextjs',
    supabaseProjectId: 'bgqjgpvzokonkyiljasj',
    supabaseUrlSecret: 'SUPABASE_URL_043',
    supabaseServiceKeySecret: 'SUPABASE_SERVICE_ROLE_KEY_043',
    supabaseTypesPath: 'src/lib/supabase/types.ts',
    nodeVersion: '20',
    defaultBranch: 'main',
    hasE2E: true,
    e2eCommand: 'npm run test:e2e',
    extraLabels: [
      { name: 'ecommerce', color: 'f8b4d9', description: 'Ecommerce feature' },
      { name: 'checkout', color: '457b9d', description: 'Checkout flow features' },
      { name: 'pdp', color: 'e591c3', description: 'Product detail page features' },
      { name: 'admin', color: '1d3557', description: 'Admin dashboard features' },
      { name: 'orders', color: 'a8dadc', description: 'Order management features' },
      { name: 'conversion', color: 'dc2626', description: 'Conversion optimization' },
      { name: 'marketing', color: 'ea580c', description: 'Marketing and growth features' },
      { name: 'social', color: '7c2d12', description: 'Social sharing features' },
    ],
    localPath: `${HOME}/management-git/one4three-co-next-app`,
    ci: {
      lintCommand: 'next lint',
      typeCheckCommand: 'tsc --noEmit',
      buildCommand: 'next build --turbopack',
      unitTestCommand: 'vitest run',
      e2e: {
        command: 'npx playwright test',
        installCommand: 'npx playwright install --with-deps chromium',
        blocking: false,
      },
    },
  },

  maximus: {
    slug: 'DaBigHomie/maximus-ai',
    alias: 'maximus',
    framework: 'nextjs',
    supabaseProjectId: 'ycqtigpjjiqhkdecwiqt',
    supabaseUrlSecret: 'SUPABASE_URL_MAXIMUS',
    supabaseServiceKeySecret: 'SUPABASE_SERVICE_ROLE_KEY_MAXIMUS',
    supabaseTypesPath: 'src/shared/types/database.ts',
    nodeVersion: '20',
    defaultBranch: 'main',
    hasE2E: false,
    e2eCommand: null,
    extraLabels: [
      { name: 'agents', color: '6366f1', description: 'Agent cluster features' },
      { name: 'payments', color: '84cc16', description: 'Stripe payment features' },
    ],
    localPath: `${HOME}/management-git/maximus-ai`,
    ci: {
      lintCommand: 'eslint',
      typeCheckCommand: 'tsc --noEmit',
      buildCommand: 'next build',
      unitTestCommand: 'vitest run',
      e2e: {
        command: 'npx playwright test',
        installCommand: 'npx playwright install --with-deps chromium',
        blocking: false,
      },
    },
  },

  cae: {
    slug: 'DaBigHomie/Cae',
    alias: 'cae',
    framework: 'vite-react',
    supabaseProjectId: null,
    supabaseUrlSecret: null,
    supabaseServiceKeySecret: null,
    supabaseTypesPath: null,
    nodeVersion: '20',
    defaultBranch: 'main',
    hasE2E: false,
    e2eCommand: null,
    extraLabels: [
      { name: 'cultural', color: 'f8b4d9', description: 'Cultural validation' },
      { name: 'conversion', color: 'dc2626', description: 'Conversion optimization' },
    ],
    localPath: `${HOME}/management-git/cae-luxury-hair`,
    ci: {
      lintCommand: null,
      typeCheckCommand: null,
      buildCommand: 'vite build',
      unitTestCommand: null,
      e2e: null,
    },
  },

  atb: {
    slug: 'DaBigHomie/atl-table-booking-app',
    alias: 'atb',
    framework: 'node',
    supabaseProjectId: null,
    supabaseUrlSecret: 'SUPABASE_URL',
    supabaseServiceKeySecret: 'SUPABASE_SERVICE_ROLE_KEY',
    supabaseTypesPath: 'packages/shared/types/supabase.ts',
    nodeVersion: '20',
    defaultBranch: 'main',
    hasE2E: true,
    e2eCommand: 'npx playwright test',
    extraLabels: [
      { name: 'mobile', color: '10b981', description: 'Expo mobile app' },
      { name: 'admin', color: '6366f1', description: 'Next.js admin dashboard' },
      { name: 'booking', color: 'f59e0b', description: 'Booking flow feature' },
      { name: 'payments', color: 'ef4444', description: 'Stripe payments integration' },
    ],
    localPath: `${HOME}/management-git/atl-table-booking-app`,
    ci: {
      lintCommand: 'pnpm turbo lint',
      typeCheckCommand: 'pnpm turbo typecheck',
      buildCommand: 'pnpm turbo build',
      unitTestCommand: 'pnpm --filter @atl/api test:unit',
      e2e: {
        command: 'npx playwright test',
        installCommand: 'npx playwright install --with-deps chromium',
        blocking: false,
      },
    },
  },

  ugwtf: {
    slug: 'DaBigHomie/ugwtf',
    alias: 'ugwtf',
    framework: 'node',
    supabaseProjectId: null,
    supabaseUrlSecret: null,
    supabaseServiceKeySecret: null,
    supabaseTypesPath: null,
    nodeVersion: '20',
    defaultBranch: 'main',
    hasE2E: false,
    e2eCommand: null,
    extraLabels: [
      { name: 'publish', color: '6366f1', description: 'npm publish pipeline' },
      { name: 'dogfood', color: '8b5cf6', description: 'Self-validation (UGWTF on UGWTF)' },
    ],
    localPath: `${HOME}/management-git/ugwtf`,
    ci: {
      lintCommand: null,
      typeCheckCommand: 'tsc --noEmit',
      buildCommand: 'npm run build',
      unitTestCommand: 'vitest run',
      e2e: null,
    },
  },

  'image-gen': {
    slug: 'DaBigHomie/image-gen-30x-cli',
    alias: 'image-gen',
    framework: 'node',
    supabaseProjectId: null,
    supabaseUrlSecret: null,
    supabaseServiceKeySecret: null,
    supabaseTypesPath: null,
    nodeVersion: '20',
    defaultBranch: 'main',
    hasE2E: false,
    e2eCommand: null,
    extraLabels: [
      { name: 'infrastructure', color: '0284c7', description: 'CLI infrastructure and tooling' },
      { name: 'prompts', color: '7c3aed', description: 'Image generation prompt updates' },
    ],
    localPath: `${HOME}/management-git/image-gen-30x-cli`,
    ci: {
      lintCommand: 'npm run validate',
      typeCheckCommand: 'tsc --noEmit',
      buildCommand: null,
      unitTestCommand: 'npm test',
      e2e: null,
    },
  },

  'audit-fix-ship': {
    slug: 'DaBigHomie/audit-fix-ship',
    alias: 'audit-fix-ship',
    framework: 'node',
    supabaseProjectId: null,
    supabaseUrlSecret: null,
    supabaseServiceKeySecret: null,
    supabaseTypesPath: null,
    nodeVersion: '20',
    defaultBranch: 'main',
    hasE2E: false,
    e2eCommand: null,
    extraLabels: [
      { name: 'skill', color: '7c3aed', description: 'Claude skill content (SKILL.md, templates)' },
      { name: 'wave', color: '0ea5e9', description: 'Wave 0/1/2/3/3.5/4 audit-fix-ship cycle' },
      { name: 'prompt-batch', color: 'f59e0b', description: 'Generated prompt batch for agent pipeline' },
    ],
    localPath: `${HOME}/management-git/audit-fix-ship`,
    skipWorkflowDeploy: true,
    ci: {
      lintCommand: null,
      typeCheckCommand: 'tsc --noEmit -p scripts/tsconfig.json',
      buildCommand: null,
      unitTestCommand: null,
      e2e: null,
    },
  },

  'stitch-mockup-toolkit': {
    slug: 'DaBigHomie/stitch-mockup-toolkit',
    alias: 'stitch-mockup-toolkit',
    framework: 'node',
    supabaseProjectId: null,
    supabaseUrlSecret: null,
    supabaseServiceKeySecret: null,
    supabaseTypesPath: null,
    nodeVersion: '20',
    defaultBranch: 'main',
    hasE2E: false,
    e2eCommand: null,
    extraLabels: [
      { name: 'mockup', color: '7c3aed', description: 'Google Stitch mockup prompt or output' },
      { name: 'brand-config', color: 'f59e0b', description: 'brand.config.json or template change' },
    ],
    localPath: `${HOME}/management-git/stitch-mockup-toolkit`,
    ci: {
      lintCommand: null,
      typeCheckCommand: null,
      buildCommand: null,
      unitTestCommand: null,
      e2e: null,
    },
  },

  "docs-standards": {
    slug: "DaBigHomie/documentation-standards",
    alias: "docs-standards",
    framework: "node",
    supabaseProjectId: null,
    supabaseUrlSecret: null,
    supabaseServiceKeySecret: null,
    supabaseTypesPath: null,
    nodeVersion: "20",
    defaultBranch: "master",
    hasE2E: false,
    e2eCommand: null,
    extraLabels: [
      { name: "workspace-rule", color: "7c3aed", description: "Universal rule synced across registered repos" },
      { name: "sync-target", color: "0ea5e9", description: "Cross-repo sync target (push-rules.mts)" },
    ],
    localPath: `${HOME}/management-git/documentation-standards`,
    ci: {
      lintCommand: null,
      typeCheckCommand: null,
      buildCommand: null,
      unitTestCommand: null,
      e2e: null,
    },
  },
};

/** Resolve repo config by alias or slug */
export function getRepo(nameOrAlias: string): RepoConfig | undefined {
  return REPOS[nameOrAlias] ??
    Object.values(REPOS).find(r => r.slug === nameOrAlias || r.alias === nameOrAlias);
}

/** All repo aliases */
export function allAliases(): string[] {
  return Object.keys(REPOS);
}

// ---------------------------------------------------------------------------
// G48: External repo registration (without editing this file)
// ---------------------------------------------------------------------------

/**
 * Register an external repo at runtime.
 * Plugins and `.ugwtfrc.json` can call this to add repos without
 * editing the static REPOS record.
 *
 * @throws If the alias is already registered.
 */
export function registerRepo(config: RepoConfig): void {
  if (REPOS[config.alias]) {
    throw new Error(`Repo alias "${config.alias}" is already registered.`);
  }
  REPOS[config.alias] = config;
}

/**
 * Register repos from a `.ugwtfrc.json` `repos` array.
 * Each entry must be a partial RepoConfig with at least `slug` and `alias`.
 * Missing fields get sensible defaults.
 */
export function registerReposFromRC(repos: Partial<RepoConfig>[]): void {
  for (const partial of repos) {
    if (!partial.slug || !partial.alias) continue;
    if (REPOS[partial.alias]) continue; // skip if already registered

    const config: RepoConfig = {
      slug: partial.slug,
      alias: partial.alias,
      framework: partial.framework ?? 'node',
      supabaseProjectId: partial.supabaseProjectId ?? null,
      supabaseUrlSecret: partial.supabaseUrlSecret ?? null,
      supabaseServiceKeySecret: partial.supabaseServiceKeySecret ?? null,
      supabaseTypesPath: partial.supabaseTypesPath ?? null,
      nodeVersion: partial.nodeVersion ?? '20',
      defaultBranch: partial.defaultBranch ?? 'main',
      hasE2E: partial.hasE2E ?? false,
      e2eCommand: partial.e2eCommand ?? null,
      extraLabels: partial.extraLabels ?? [],
      localPath: partial.localPath ?? `${HOME}/${partial.alias}`,
      ci: partial.ci ?? {
        lintCommand: null,
        typeCheckCommand: null,
        buildCommand: null,
        unitTestCommand: null,
        e2e: null,
      },
    };

    REPOS[config.alias] = config;
  }
}
