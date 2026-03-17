/**
 * Auth Agents
 *
 * Validate authentication configuration, RLS policies,
 * and auth flow completeness.
 */
import type { Agent, AgentResult } from '../types.js';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Agent: Auth Config Validator
// ---------------------------------------------------------------------------

const authConfigValidator: Agent = {
  id: 'auth-config-validator',
  name: 'Auth Config Validator',
  description: 'Verify auth provider configuration and protected routes',
  clusterId: 'auth',
  shouldRun() {
    return true;
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`Auth Config: ${ctx.repoAlias}`);

    const findings: string[] = [];
    const pkgPath = join(ctx.localPath, 'package.json');

    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Detect auth libraries
      const authLibs: Record<string, string> = {
        '@supabase/supabase-js': 'Supabase Auth',
        '@supabase/auth-helpers-nextjs': 'Supabase Auth Helpers',
        '@supabase/ssr': 'Supabase SSR Auth',
        'next-auth': 'NextAuth.js',
        '@auth/core': 'Auth.js',
        '@clerk/nextjs': 'Clerk',
        firebase: 'Firebase Auth',
        'passport': 'Passport.js',
      };

      for (const [dep, label] of Object.entries(authLibs)) {
        if (allDeps[dep]) {
          findings.push(`✅ ${label} detected (${allDeps[dep]})`);
        }
      }

      if (findings.length === 0) {
        findings.push('⚠ No auth library detected');
      }
    } catch {
      findings.push('⚠ Could not read package.json');
    }

    // Check for middleware (Next.js auth guard)
    const middlewarePath = join(ctx.localPath, 'middleware.ts');
    const srcMiddleware = join(ctx.localPath, 'src', 'middleware.ts');
    const hasMiddleware =
      (await stat(middlewarePath).catch(() => null))?.isFile() ||
      (await stat(srcMiddleware).catch(() => null))?.isFile();

    if (hasMiddleware) {
      findings.push('✅ Middleware found (route protection)');
    }

    // Check for auth context/provider
    const srcDir = join(ctx.localPath, 'src');
    const authFiles = await findFiles(srcDir, /auth/i, 3);
    if (authFiles.length > 0) {
      findings.push(`✅ ${authFiles.length} auth-related files in src/`);
    }

    ctx.logger.info(findings.join('\n  '));
    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: findings.join('; '),
      artifacts: findings,
    };
  },
};

// ---------------------------------------------------------------------------
// Agent: RLS Policy Scanner
// ---------------------------------------------------------------------------

const rlsPolicyScanner: Agent = {
  id: 'rls-policy-scanner',
  name: 'RLS Policy Scanner',
  description: 'Verify Row-Level Security policies in Supabase migrations',
  clusterId: 'auth',
  shouldRun(ctx) {
    // Only run for repos with Supabase
    return ['damieus', 'ffs', '043', 'maximus'].includes(ctx.repoAlias);
  },

  async execute(ctx): Promise<AgentResult> {
    const start = Date.now();
    ctx.logger.group(`RLS Policies: ${ctx.repoAlias}`);

    const migrationsDir = join(ctx.localPath, 'supabase', 'migrations');
    const rlsFound: string[] = [];
    const tablesWithoutRls: string[] = [];

    let migrations: string[];
    try {
      migrations = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql'));
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

    const createdTables = new Set<string>();
    const rlsTables = new Set<string>();

    for (const file of migrations) {
      try {
        const content = await readFile(join(migrationsDir, file), 'utf-8');

        // Find CREATE TABLE statements
        const createMatches = content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)/gi);
        for (const m of createMatches) {
          if (m[1]) createdTables.add(m[1]);
        }

        // Find ENABLE ROW LEVEL SECURITY
        const rlsMatches = content.matchAll(/ALTER\s+TABLE\s+(?:public\.)?(\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi);
        for (const m of rlsMatches) {
          if (m[1]) {
            rlsTables.add(m[1]);
            rlsFound.push(`${m[1]} (${file})`);
          }
        }
      } catch {
        // skip
      }
    }

    // Tables without RLS
    for (const table of createdTables) {
      if (!rlsTables.has(table)) {
        tablesWithoutRls.push(table);
      }
    }

    ctx.logger.info(`Tables: ${createdTables.size}, RLS enabled: ${rlsTables.size}`);
    if (tablesWithoutRls.length > 0) {
      ctx.logger.warn(`Tables without RLS: ${tablesWithoutRls.join(', ')}`);
    }

    ctx.logger.groupEnd();

    return {
      agentId: this.id,
      status: tablesWithoutRls.length > 3 ? 'failed' : 'success',
      repo: ctx.repoAlias,
      duration: Date.now() - start,
      message: `${rlsTables.size}/${createdTables.size} tables have RLS${tablesWithoutRls.length > 0 ? ` | Missing: ${tablesWithoutRls.slice(0, 5).join(', ')}` : ''}`,
      artifacts: [...rlsFound, ...tablesWithoutRls.map((t) => `⚠ ${t}: no RLS`)],
    };
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findFiles(dir: string, pattern: RegExp, maxDepth: number): Promise<string[]> {
  if (maxDepth <= 0) return [];
  const results: string[] = [];
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const s = await stat(full).catch(() => null);
    if (!s) continue;
    if (s.isDirectory()) {
      results.push(...(await findFiles(full, pattern, maxDepth - 1)));
    } else if (pattern.test(entry)) {
      results.push(entry);
    }
  }
  return results;
}

export const authAgents: Agent[] = [authConfigValidator, rlsPolicyScanner];
