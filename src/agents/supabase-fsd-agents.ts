/**
 * Supabase + FSD Integration Agents
 *
 * Inspired by maximus-ai C05 (migration-validator, type-gen-sync, rls-policy-auditor,
 * query-optimizer, seed-data-generator) and C31 (schema-reverse-engineer,
 * supabase-migration-generator, data-integrity-validator, etl-pipeline-builder).
 *
 * Bridges the gap between Supabase schema and FSD codebase layers.
 */
import type { Agent, AgentResult } from '../types.js';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function collectFiles(dir: string, exts: string[], maxDepth = 4, depth = 0): Promise<string[]> {
  if (depth > maxDepth) return [];
  const results: string[] = [];
  let entries: string[];
  try { entries = await readdir(dir); } catch { return results; }
  for (const entry of entries) {
    if (['node_modules', '.git', 'dist', '.next'].includes(entry)) continue;
    const fullPath = join(dir, entry);
    const s = await stat(fullPath).catch(() => null);
    if (!s) continue;
    if (s.isDirectory()) results.push(...await collectFiles(fullPath, exts, maxDepth, depth + 1));
    else if (exts.some(e => entry.endsWith(e))) results.push(fullPath);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Agent: Migration Safety Auditor
// ---------------------------------------------------------------------------

const migrationSafetyAuditor: Agent = {
  id: 'supabase-migration-safety',
  name: 'Migration Safety Auditor',
  description: 'Scan Supabase migrations for destructive ops (DROP, TRUNCATE, DELETE FROM) and naming issues',
  clusterId: 'supabase-fsd',
  shouldRun(ctx) {
    // Only run if repo has supabase/migrations/
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Migration Safety: ${ctx.repoAlias}`);

    const migrationsDir = join(ctx.localPath, 'supabase', 'migrations');
    let migrations: string[];
    try {
      migrations = (await readdir(migrationsDir)).filter(f => f.endsWith('.sql'));
    } catch {
      ctx.logger.info('No supabase/migrations/ directory');
      ctx.logger.groupEnd();
      return {
        agentId: this.id, status: 'skipped', repo: ctx.repoAlias,
        duration: Date.now() - start, message: 'No migrations directory', artifacts: [],
      };
    }

    const destructiveOps: string[] = [];
    const namingIssues: string[] = [];
    const DESTRUCTIVE = /\b(DROP\s+TABLE|DROP\s+COLUMN|TRUNCATE|DELETE\s+FROM)\b/gi;
    const NAMING_PATTERN = /^\d{14}_[\w-]+\.sql$/;

    for (const migration of migrations) {
      if (!NAMING_PATTERN.test(migration) && !migration.endsWith('.skip')) {
        namingIssues.push(`${migration}: doesn't match YYYYMMDDHHMMSS_name.sql pattern`);
      }
      try {
        const content = await readFile(join(migrationsDir, migration), 'utf-8');
        const matches = content.match(DESTRUCTIVE);
        if (matches) {
          destructiveOps.push(`${migration}: ${matches.join(', ')}`);
        }
      } catch { /* skip */ }
    }

    const issues = [...destructiveOps, ...namingIssues];
    ctx.logger.info(`${migrations.length} migrations, ${destructiveOps.length} destructive, ${namingIssues.length} naming issues`);
    if (destructiveOps.length > 0) {
      for (const d of destructiveOps) ctx.logger.warn(`  ⚠️ ${d}`);
    }
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: destructiveOps.length === 0 ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${migrations.length} migrations: ${destructiveOps.length} destructive ops, ${namingIssues.length} naming issues`,
      artifacts: issues,
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Type Generation Freshness Checker
// ---------------------------------------------------------------------------

const typeGenFreshnessChecker: Agent = {
  id: 'type-gen-freshness',
  name: 'Type Generation Freshness',
  description: 'Check if Supabase-generated types.ts is stale compared to latest migration',
  clusterId: 'supabase-fsd',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Type Gen Freshness: ${ctx.repoAlias}`);

    // Find the types file
    const typePaths = [
      'src/integrations/supabase/types.ts',
      'src/shared/types/database.ts',
      'src/lib/supabase/types.ts',
    ];
    let typesFile: string | null = null;
    let typesMtime = 0;

    for (const tp of typePaths) {
      try {
        const s = await stat(join(ctx.localPath, tp));
        typesFile = tp;
        typesMtime = s.mtimeMs;
        break;
      } catch { /* try next */ }
    }

    if (!typesFile) {
      ctx.logger.warn('No Supabase types file found');
      ctx.logger.groupEnd();
      return {
        agentId: this.id, status: 'skipped', repo: ctx.repoAlias,
        duration: Date.now() - start, message: 'No Supabase types file found', artifacts: [],
      };
    }

    // Find latest migration
    const migrationsDir = join(ctx.localPath, 'supabase', 'migrations');
    let latestMigrationMtime = 0;
    let latestMigration = '';
    try {
      const migrations = (await readdir(migrationsDir)).filter(f => f.endsWith('.sql')).sort();
      if (migrations.length > 0) {
        latestMigration = migrations[migrations.length - 1] ?? '';
        const s = await stat(join(migrationsDir, latestMigration));
        latestMigrationMtime = s.mtimeMs;
      }
    } catch { /* no migrations */ }

    const isStale = latestMigrationMtime > typesMtime;
    const msg = isStale
      ? `STALE: ${typesFile} older than ${latestMigration} — regenerate types`
      : `${typesFile} is up-to-date`;

    ctx.logger.info(msg);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: isStale ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: msg,
      artifacts: isStale ? [`stale:${typesFile}`] : [],
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: RLS Completeness Auditor
// ---------------------------------------------------------------------------

const rlsCompletenessAuditor: Agent = {
  id: 'rls-completeness-auditor',
  name: 'RLS Completeness Auditor',
  description: 'Check migrations for tables without RLS policies — RLS must NEVER be bypassed',
  clusterId: 'supabase-fsd',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`RLS Completeness: ${ctx.repoAlias}`);

    const migrationsDir = join(ctx.localPath, 'supabase', 'migrations');
    let migrations: string[];
    try {
      migrations = (await readdir(migrationsDir)).filter(f => f.endsWith('.sql')).sort();
    } catch {
      ctx.logger.groupEnd();
      return {
        agentId: this.id, status: 'skipped', repo: ctx.repoAlias,
        duration: Date.now() - start, message: 'No migrations directory', artifacts: [],
      };
    }

    const tablesCreated = new Set<string>();
    const tablesWithRLS = new Set<string>();

    for (const migration of migrations) {
      try {
        const content = await readFile(join(migrationsDir, migration), 'utf-8');

        // Find CREATE TABLE statements
        const creates = content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)/gi);
        for (const m of creates) if (m[1]) tablesCreated.add(m[1]);

        // Find ALTER TABLE ... ENABLE ROW LEVEL SECURITY
        const rls = content.matchAll(/ALTER\s+TABLE\s+(?:public\.)?(\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi);
        for (const m of rls) if (m[1]) tablesWithRLS.add(m[1]);

        // Also check for CREATE POLICY
        const policies = content.matchAll(/CREATE\s+POLICY\s+.*ON\s+(?:public\.)?(\w+)/gi);
        for (const m of policies) if (m[1]) tablesWithRLS.add(m[1]);
      } catch { /* skip */ }
    }

    const unprotected = [...tablesCreated].filter(t => !tablesWithRLS.has(t));
    const msg = `${tablesCreated.size} tables, ${tablesWithRLS.size} with RLS, ${unprotected.length} unprotected`;

    if (unprotected.length > 0) {
      for (const t of unprotected) ctx.logger.warn(`  ⚠️ No RLS: ${t}`);
    }
    ctx.logger.info(msg);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: unprotected.length === 0 ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: msg,
      artifacts: unprotected.map(t => `no-rls:${t}`),
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Schema-to-FSD Mapper
// ---------------------------------------------------------------------------

const schemaToFsdMapper: Agent = {
  id: 'schema-to-fsd-mapper',
  name: 'Schema-to-FSD Mapper',
  description: 'Map database tables to FSD entity/feature layers and detect unmapped schemas',
  clusterId: 'supabase-fsd',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Schema-FSD Mapping: ${ctx.repoAlias}`);

    // Extract table names from types file
    const typePaths = [
      'src/integrations/supabase/types.ts',
      'src/shared/types/database.ts',
      'src/lib/supabase/types.ts',
    ];
    const tables: string[] = [];

    for (const tp of typePaths) {
      try {
        const content = await readFile(join(ctx.localPath, tp), 'utf-8');
        // Supabase types have tables as keys under Tables: { table_name: { Row: {...} } }
        const tableMatches = content.matchAll(/(\w+):\s*\{\s*Row:\s*\{/g);
        for (const m of tableMatches) if (m[1]) tables.push(m[1]);
        break;
      } catch { /* try next */ }
    }

    if (tables.length === 0) {
      ctx.logger.info('No tables found in types file');
      ctx.logger.groupEnd();
      return {
        agentId: this.id, status: 'skipped', repo: ctx.repoAlias,
        duration: Date.now() - start, message: 'No tables found', artifacts: [],
      };
    }

    // Check which tables have corresponding FSD entities or feature hooks
    const entityFiles = await collectFiles(join(ctx.localPath, 'src', 'entities'), ['.ts', '.tsx']);
    const featureFiles = await collectFiles(join(ctx.localPath, 'src', 'features'), ['.ts', '.tsx']);
    const hookFiles = await collectFiles(join(ctx.localPath, 'src', 'hooks'), ['.ts']);
    const allCodeFiles = [...entityFiles, ...featureFiles, ...hookFiles];
    const allCode = allCodeFiles.map(f => f.toLowerCase()).join(' ');

    const unmapped: string[] = [];
    for (const table of tables) {
      const normalized = table.toLowerCase().replace(/_/g, '');
      if (!allCode.includes(normalized) && !allCode.includes(table.toLowerCase())) {
        unmapped.push(table);
      }
    }

    ctx.logger.info(`${tables.length} tables, ${unmapped.length} not referenced in entities/features/hooks`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${tables.length} tables: ${unmapped.length} unmapped to FSD layers`,
      artifacts: unmapped.map(t => `unmapped:${t}`),
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Query Pattern Analyzer
// ---------------------------------------------------------------------------

const queryPatternAnalyzer: Agent = {
  id: 'query-pattern-analyzer',
  name: 'Query Pattern Analyzer',
  description: 'Detect Supabase query anti-patterns: missing .single(), unfiltered selects, no error handling',
  clusterId: 'supabase-fsd',
  shouldRun() { return true; },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Query Patterns: ${ctx.repoAlias}`);

    const srcFiles = await collectFiles(join(ctx.localPath, 'src'), ['.ts', '.tsx']);
    const issues: string[] = [];

    for (const file of srcFiles.slice(0, 100)) {
      try {
        const content = await readFile(file, 'utf-8');
        if (!content.includes('supabase')) continue;

        // Detect .from().select() without .eq() or .filter() — potential full table scan
        const unfilteredSelects = content.match(/\.from\(['"][^'"]+['"]\)\s*\.select\([^)]*\)\s*(?!\.(?:eq|neq|gt|lt|gte|lte|in|contains|filter|match|ilike|like|or|and|single|maybeSingle|limit|range|order))/g);
        if (unfilteredSelects) {
          issues.push(`${file}: ${unfilteredSelects.length} unfiltered select(s) — potential full table scan`);
        }

        // Detect missing error handling on supabase calls
        const supabaseCalls = content.match(/await\s+supabase\s*\.\s*from/g);
        const errorChecks = content.match(/\.error\b/g);
        if (supabaseCalls && !errorChecks) {
          issues.push(`${file}: Supabase queries without .error checking`);
        }
      } catch { /* skip */ }
    }

    ctx.logger.info(`${issues.length} query pattern issues`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: issues.length === 0 ? 'success' : 'failed',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${issues.length} query anti-patterns detected`,
      artifacts: issues,
    };
  },
};

export const supabaseFsdAgents: Agent[] = [
  migrationSafetyAuditor,
  typeGenFreshnessChecker,
  rlsCompletenessAuditor,
  schemaToFsdMapper,
  queryPatternAnalyzer,
];
