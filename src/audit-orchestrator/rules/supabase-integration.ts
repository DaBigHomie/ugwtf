/**
 * Rule: Supabase integration — client, types, migrations, RLS, queries.
 * Only reports issues if the project uses Supabase.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditRuleContext, AuditIssue } from '../types.js';
import { countMatches } from '../scanner.js';

export function auditSupabaseIntegration(ctx: AuditRuleContext): AuditIssue[] {
  const issues: AuditIssue[] = [];

  const clientPaths = [
    join(ctx.root, 'lib', 'supabase'),
    join(ctx.root, 'src', 'lib', 'supabase'),
    join(ctx.root, 'src', 'shared', 'lib', 'supabase-browser.ts'),
    join(ctx.root, 'src', 'integrations', 'supabase'),
  ];
  const hasClient = clientPaths.some((p) => existsSync(p));

  // Not a Supabase project — skip
  if (!hasClient) return [];

  // Check for generated types
  const typePaths = [
    join(ctx.root, 'lib', 'supabase', 'types.ts'),
    join(ctx.root, 'src', 'lib', 'supabase', 'types.ts'),
    join(ctx.root, 'src', 'shared', 'types', 'database.ts'),
    join(ctx.root, 'src', 'integrations', 'supabase', 'types.ts'),
  ];
  if (!typePaths.some((p) => existsSync(p))) {
    issues.push({
      id: 'SB-01', title: 'Supabase types file not found', severity: 'high', category: 'integration',
      description: 'Supabase client exists but no generated types file found',
      affectedFiles: [], completionPct: 0,
    });
  }

  // Migrations
  const migrationDir = join(ctx.root, 'supabase', 'migrations');
  if (!existsSync(migrationDir)) {
    issues.push({
      id: 'SB-02', title: 'No Supabase migrations directory', severity: 'high', category: 'integration',
      description: 'No supabase/migrations directory found',
      affectedFiles: [migrationDir], completionPct: 0,
    });
  } else {
    const migrations = readdirSync(migrationDir).filter((f) => f.endsWith('.sql'));
    if (migrations.length === 0) {
      issues.push({
        id: 'SB-02', title: 'No SQL migration files', severity: 'high', category: 'integration',
        description: 'Migrations directory exists but contains no .sql files',
        affectedFiles: [migrationDir], completionPct: 0,
      });
    } else {
      const hasRLS = migrations.some((f) => {
        const sql = readFileSync(join(migrationDir, f), 'utf-8');
        return /ENABLE ROW LEVEL SECURITY|CREATE POLICY/i.test(sql);
      });
      if (!hasRLS) {
        issues.push({
          id: 'SB-03', title: 'No RLS policies in migrations', severity: 'high', category: 'integration',
          description: `${migrations.length} migration files found but no ENABLE ROW LEVEL SECURITY or CREATE POLICY`,
          affectedFiles: [migrationDir], completionPct: 0,
        });
      }
    }
  }

  // Server queries
  const srcDir = ctx.adapter.resolveSrc(ctx.root);
  const serverQueries = countMatches(srcDir, /supabase\.from\(/g);
  if (serverQueries < 3) {
    issues.push({
      id: 'SB-04', title: `Low Supabase query usage (${serverQueries} found)`, severity: 'medium', category: 'integration',
      description: `Found ${serverQueries} supabase.from() queries (target: 3+)`,
      affectedFiles: [srcDir], completionPct: Math.min(100, Math.round((serverQueries / 3) * 100)),
    });
  }

  return issues;
}
