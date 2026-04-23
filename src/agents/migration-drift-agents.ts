/**
 * Migration Drift Agents
 *
 * Detect drift between local supabase/migrations/*.sql and remote
 * supabase_migrations.schema_migrations via Supabase Management API.
 *
 * Also greps migration files for forbidden role wrappers
 * (SET ROLE supabase_storage_admin / supabase_auth_admin) which silently
 * swallow permission errors at the API layer and produce drift between
 * local and remote.
 */
import type { Agent, AgentResult, AgentFinding } from '../types.js';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getRepo } from '../config/repo-registry.js';

const FORBIDDEN_ROLE_RE = /SET\s+(LOCAL\s+)?ROLE\s+supabase_(storage|auth)_admin/i;

const forbiddenRoleScanner: Agent = {
  id: 'forbidden-role-scanner',
  name: 'Forbidden Role Wrapper Scanner',
  description: 'Reject SET ROLE supabase_storage_admin / supabase_auth_admin in migration files',
  clusterId: 'migration-drift',
  shouldRun(ctx) {
    return !!getRepo(ctx.repoAlias)?.supabaseProjectId;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Forbidden Role Scan: ${ctx.repoAlias}`);

    const migrationsDir = join(ctx.localPath, 'supabase', 'migrations');
    const findings: AgentFinding[] = [];

    let files: string[];
    try {
      files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
    } catch {
      ctx.logger.info('No supabase/migrations/ directory');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: 'No migrations directory', artifacts: [] };
    }

    for (const file of files) {
      const migrationPath = join(migrationsDir, file);
      try {
        const sql = await readFile(migrationPath, 'utf-8');
        const stripped = sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
        if (FORBIDDEN_ROLE_RE.test(stripped)) {
          findings.push({
            severity: 'error',
            file: `supabase/migrations/${file}`,
            message: 'Forbidden SET ROLE supabase_(storage|auth)_admin wrapper',
            suggestion: 'Rewrite as plain DDL — the migration role (postgres) already owns storage.* and auth.* tables.',
          });
          ctx.logger.warn(`  X ${file}: forbidden role wrapper`);
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        findings.push({
          severity: 'error',
          file: `supabase/migrations/${file}`,
          message: `Unable to read migration file: ${reason}`,
          suggestion: 'Ensure the migration file exists, is readable, and contains valid text content.',
        });
        ctx.logger.warn(`  X ${file}: unable to read migration file (${reason})`);
      }
    }

    ctx.logger.info(`Scanned ${files.length} migration file(s), ${findings.length} forbidden pattern(s)`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: findings.length > 0 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${files.length} files scanned, ${findings.length} forbidden role wrapper(s)`,
      artifacts: findings.map((f) => `${f.file}: ${f.message}`),
      findings,
    };
  },
};

const schemaMigrationDriftChecker: Agent = {
  id: 'schema-migration-drift-checker',
  name: 'Schema Migration Drift Checker',
  description: 'Compare local migrations vs remote schema_migrations via Management API',
  clusterId: 'migration-drift',
  shouldRun(ctx) {
    return !!getRepo(ctx.repoAlias)?.supabaseProjectId && !!process.env.SUPABASE_ACCESS_TOKEN;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Drift Check: ${ctx.repoAlias}`);

    const projectRef = getRepo(ctx.repoAlias)?.supabaseProjectId;
    const token = process.env.SUPABASE_ACCESS_TOKEN;
    if (!projectRef || !token) {
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: 'Missing project ref or SUPABASE_ACCESS_TOKEN', artifacts: [] };
    }

    const migrationsDir = join(ctx.localPath, 'supabase', 'migrations');
    let localVersions: string[] = [];
    try {
      localVersions = (await readdir(migrationsDir))
        .filter((f) => /^\d{14}_.*\.sql$/.test(f))
        .map((f) => f.slice(0, 14))
        .sort();
    } catch {
      ctx.logger.info('No supabase/migrations/ directory');
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'skipped', repo: ctx.repoAlias, duration: Date.now() - start, message: 'No migrations directory', artifacts: [] };
    }

    if (ctx.dryRun) {
      ctx.logger.info(`[dry-run] Would query ${projectRef} for ${localVersions.length} local versions`);
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'success', repo: ctx.repoAlias, duration: Date.now() - start, message: `[dry-run] ${localVersions.length} local migrations`, artifacts: [] };
    }

    let remoteVersions: string[] = [];
    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;' }),
      });
      if (!res.ok) throw new Error(`Management API ${res.status}: ${await res.text()}`);
      const rows = (await res.json()) as Array<{ version: string }>;
      remoteVersions = rows.map((r) => r.version).sort();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.logger.warn(`API error: ${msg}`);
      ctx.logger.groupEnd();
      return { agentId: this.id, status: 'failed', repo: ctx.repoAlias, duration: Date.now() - start, message: `API error: ${msg}`, artifacts: [], error: msg };
    }

    const localOnly = localVersions.filter((v) => !remoteVersions.includes(v));
    const remoteOnly = remoteVersions.filter((v) => !localVersions.includes(v));
    const drift = localOnly.length + remoteOnly.length;

    const findings: AgentFinding[] = [];
    for (const v of localOnly) findings.push({ severity: 'error', message: `Local-only migration ${v} not applied to remote`, suggestion: 'Run apply-migration-via-rest.cjs or supabase db push' });
    for (const v of remoteOnly) findings.push({ severity: 'error', message: `Remote-only migration ${v} missing from repo`, suggestion: 'Backfill .sql or insert no-op with matching timestamp' });

    ctx.logger.info(`Local: ${localVersions.length} | Remote: ${remoteVersions.length} | Drift: ${drift}`);
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: drift > 0 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: drift > 0 ? `Drift: ${localOnly.length} local-only, ${remoteOnly.length} remote-only` : `In sync (${localVersions.length}/${remoteVersions.length})`,
      artifacts: [...localOnly.map((v) => `local-only: ${v}`), ...remoteOnly.map((v) => `remote-only: ${v}`)],
      findings,
    };
  },
};

export const migrationDriftAgents: Agent[] = [forbiddenRoleScanner, schemaMigrationDriftChecker];
