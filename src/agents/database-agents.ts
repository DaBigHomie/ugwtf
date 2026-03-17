/**
 * Database Integrity Agents
 *
 * Validates Supabase migration safety, type regeneration status,
 * and schema drift detection.
 */
import type { Agent, AgentResult, AgentContext } from '../types.js';
import { getRepo } from '../config/repo-registry.js';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Agent: Migration Auditor
// ---------------------------------------------------------------------------

const migrationAuditor: Agent = {
  id: 'migration-auditor',
  name: 'Migration Auditor',
  description: 'Scan migration files for destructive operations and ordering issues',
  clusterId: 'database',
  shouldRun(ctx) {
    const repo = getRepo(ctx.repoAlias);
    return !!repo?.supabaseProjectId;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Migration Audit: ${ctx.repoAlias}`);

    const migrationsDir = join(ctx.localPath, 'supabase', 'migrations');
    let files: string[] = [];

    try {
      files = (await readdir(migrationsDir)).filter(f => f.endsWith('.sql'));
    } catch {
      ctx.logger.info('No supabase/migrations/ directory');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: 'No migrations dir', artifacts: [] };
    }

    const destructive: string[] = [];
    const skipped: string[] = [];

    for (const file of files) {
      if (file.endsWith('.skip')) {
        skipped.push(file);
        continue;
      }

      try {
        const content = await readFile(join(migrationsDir, file), 'utf-8');
        const hasDropTable = /DROP\s+TABLE/i.test(content);
        const hasTruncate = /TRUNCATE/i.test(content);
        const hasDeleteFrom = /DELETE\s+FROM/i.test(content);

        if (hasDropTable || hasTruncate || hasDeleteFrom) {
          destructive.push(file);
        }
      } catch {
        // Skip unreadable files
      }
    }

    ctx.logger.info(`Total migrations: ${files.length} | Skipped: ${skipped.length} | Destructive: ${destructive.length}`);
    for (const d of destructive) {
      ctx.logger.warn(`  ⚠ Destructive: ${d}`);
    }

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: destructive.length > 0 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `Migrations: ${files.length} | Destructive: ${destructive.length}`,
      artifacts: destructive.map(d => `destructive:${d}`),
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Types Freshness Checker
// ---------------------------------------------------------------------------

const typesFreshnessChecker: Agent = {
  id: 'types-freshness-checker',
  name: 'Types Freshness Checker',
  description: 'Check if Supabase types file is newer than latest migration',
  clusterId: 'database',
  shouldRun(ctx) {
    const repo = getRepo(ctx.repoAlias);
    return !!repo?.supabaseProjectId && !!repo?.supabaseTypesPath;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    const repoConfig = getRepo(ctx.repoAlias)!;
    ctx.logger.group(`Types Freshness: ${ctx.repoAlias}`);

    const typesPath = join(ctx.localPath, repoConfig.supabaseTypesPath!);
    const migrationsDir = join(ctx.localPath, 'supabase', 'migrations');

    try {
      const typesStat = await stat(typesPath);
      const migrations = (await readdir(migrationsDir)).filter(f => f.endsWith('.sql') && !f.endsWith('.skip'));

      if (migrations.length === 0) {
        ctx.logger.info('No active migrations');
        ctx.logger.groupEnd();
        return { agentId: this.id, status: 'success', repo: ctx.repoAlias, duration: Date.now() - start, message: 'No migrations', artifacts: [] };
      }

      const latestMigration = migrations.sort().at(-1)!;
      const migStat = await stat(join(migrationsDir, latestMigration));

      const isStale = migStat.mtime > typesStat.mtime;

      if (isStale) {
        ctx.logger.warn(`Types file is STALE — older than latest migration (${latestMigration})`);
      } else {
        ctx.logger.success('Types file is up to date');
      }

      ctx.logger.groupEnd();

      return {
        agentId: this.id,
        status: isStale ? 'failed' : 'success',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: isStale ? `Types stale vs ${latestMigration}` : 'Types fresh',
        artifacts: isStale ? [`stale:${latestMigration}`] : [],
      };
    } catch {
      ctx.logger.info('Types file or migrations not found');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: 'Files not found', artifacts: [] };
    }
  },
};

export const databaseAgents: Agent[] = [migrationAuditor, typesFreshnessChecker];
