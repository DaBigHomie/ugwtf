/**
 * Migration Agents
 *
 * Track data migration progress across repos,
 * validate migration completeness and ordering.
 */
import type { Agent, AgentResult } from '../types.js';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Agent: Migration Order Validator
// ---------------------------------------------------------------------------

const migrationOrderValidator: Agent = {
  id: 'migration-order-validator',
  name: 'Migration Order Validator',
  description: 'Verify migration files are properly ordered and named',
  clusterId: 'migration',
  shouldRun(ctx) {
    return ['damieus', 'ffs', '043', 'maximus'].includes(ctx.repoAlias);
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Migration Order: ${ctx.repoAlias}`);

    const migrationsDir = join(ctx.localPath, 'supabase', 'migrations');
    let files: string[];
    try {
      files = (await readdir(migrationsDir))
        .filter((f) => f.endsWith('.sql'))
        .sort();
    } catch {
      ctx.logger.info('No supabase/migrations/ directory');
      ctx.logger.groupEnd();
      return {
        agentId: this.id,
        status: 'success',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: 'No migrations directory',
        artifacts: [],
      };
    }

    const issues: string[] = [];
    const timestamps = new Set<string>();

    for (const file of files) {
      // Expected format: YYYYMMDDHHMMSS_description.sql
      const match = file.match(/^(\d{14})_(.+)\.sql$/);
      if (!match) {
        // Allow .skip files
        if (!file.includes('.skip')) {
          issues.push(`Invalid name format: ${file}`);
        }
        continue;
      }

      const timestamp = match[1] ?? '';
      if (timestamps.has(timestamp)) {
        issues.push(`Duplicate timestamp: ${timestamp} in ${file}`);
      }
      timestamps.add(timestamp);
    }

    // Check for .skip files
    const skipFiles = files.filter((f) => f.includes('.skip'));

    ctx.logger.info(`Migrations: ${files.length} total, ${skipFiles.length} skipped`);
    if (issues.length > 0) {
      for (const i of issues) ctx.logger.warn(`  ⚠ ${i}`);
    }

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: issues.length > 0 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${files.length} migrations, ${issues.length} issues${skipFiles.length > 0 ? `, ${skipFiles.length} skipped` : ''}`,
      artifacts: issues,
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: Migration Size Analyzer
// ---------------------------------------------------------------------------

const migrationSizeAnalyzer: Agent = {
  id: 'migration-size-analyzer',
  name: 'Migration Size Analyzer',
  description: 'Track migration file sizes and flag oversized ones',
  clusterId: 'migration',
  shouldRun(ctx) {
    return ['damieus', 'ffs', '043', 'maximus'].includes(ctx.repoAlias);
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Migration Size: ${ctx.repoAlias}`);

    const migrationsDir = join(ctx.localPath, 'supabase', 'migrations');
    let files: string[];
    try {
      files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql'));
    } catch {
      ctx.logger.groupEnd();
      return {
        agentId: this.id,
        status: 'success',
        repo: ctx.repoAlias,
        duration: Date.now() - start,
        message: 'No migrations directory',
        artifacts: [],
      };
    }

    let totalSize = 0;
    const large: string[] = [];
    const MAX_MIGRATION_SIZE = 50_000; // 50KB per migration is suspicious

    for (const file of files) {
      const fullPath = join(migrationsDir, file);
      const s = await stat(fullPath).catch(() => null);
      if (!s) continue;
      totalSize += s.size;
      if (s.size > MAX_MIGRATION_SIZE) {
        large.push(`${file} (${(s.size / 1024).toFixed(0)}KB)`);
      }
    }

    const totalKb = (totalSize / 1024).toFixed(0);
    ctx.logger.info(`Total: ${totalKb}KB across ${files.length} files`);
    if (large.length > 0) {
      ctx.logger.warn(`Large migrations: ${large.join(', ')}`);
    }

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${files.length} migrations, ${totalKb}KB total${large.length > 0 ? `, ${large.length} oversized` : ''}`,
      artifacts: large,
    };
  },
};

export const migrationAgents: Agent[] = [migrationOrderValidator, migrationSizeAnalyzer];
