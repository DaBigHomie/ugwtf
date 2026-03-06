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
  /** Whether repo has E2E tests */
  hasE2E: boolean;
  /** E2E command (if hasE2E) */
  e2eCommand: string | null;
  /** Extra labels beyond the universal set */
  extraLabels: LabelDef[];
  /** Absolute local path (for validation / file writing) */
  localPath: string;
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
