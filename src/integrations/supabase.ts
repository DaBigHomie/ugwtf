/**
 * UGWTF Supabase Integration
 *
 * Provides Supabase client factory for repos with Supabase configuration.
 * Used for chain state tracking, audit result persistence, and cross-repo
 * data aggregation.
 *
 * NOTE: This is a scaffold. Actual Supabase operations require:
 *  - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars per repo
 *  - Or a central UGWTF Supabase project for orchestration state
 *
 * Environment variables follow the pattern:
 *   SUPABASE_URL_{REPO_ALIAS_UPPER}   e.g. SUPABASE_URL_DAMIEUS
 *   SUPABASE_SERVICE_ROLE_KEY_{ALIAS}  e.g. SUPABASE_SERVICE_ROLE_KEY_DAMIEUS
 */

import { getRepo, type RepoConfig } from '../config/repo-registry.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SupabaseCredentials {
  url: string;
  serviceRoleKey: string;
}

export interface ChainStateRecord {
  repo: string;
  prompt: string;
  position: number;
  issue_number: number;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
}

export interface AuditResultRecord {
  repo: string;
  command: string;
  score: number;
  details: Record<string, unknown>;
  run_at: string;
}

// ---------------------------------------------------------------------------
// Credential Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve Supabase credentials for a repo from environment variables.
 * Returns null if the repo has no Supabase config or env vars are missing.
 */
export function resolveCredentials(repoAlias: string): SupabaseCredentials | null {
  const repo = getRepo(repoAlias);
  if (!repo?.supabaseProjectId) return null;

  const url = repo.supabaseUrlSecret ? process.env[repo.supabaseUrlSecret] : undefined;
  const key = repo.supabaseServiceKeySecret ? process.env[repo.supabaseServiceKeySecret] : undefined;

  if (!url || !key) return null;

  return { url, serviceRoleKey: key };
}

/**
 * Check if a repo has Supabase configured (doesn't check env vars).
 */
export function hasSupabase(repoAlias: string): boolean {
  const repo = getRepo(repoAlias);
  return repo?.supabaseProjectId !== null && repo?.supabaseProjectId !== undefined;
}

/**
 * Get the Supabase project URL for a repo (public, no key needed).
 */
export function getProjectUrl(repoAlias: string): string | null {
  const repo = getRepo(repoAlias);
  if (!repo?.supabaseProjectId) return null;
  return `https://${repo.supabaseProjectId}.supabase.co`;
}

/**
 * Get the types file path for a repo's Supabase types.
 */
export function getTypesPath(repoAlias: string): string | null {
  const repo = getRepo(repoAlias);
  return repo?.supabaseTypesPath ?? null;
}

/**
 * Build the command to regenerate Supabase types for a repo.
 */
export function getRegenTypesCommand(repoAlias: string): string | null {
  const repo = getRepo(repoAlias);
  if (!repo?.supabaseProjectId || !repo.supabaseTypesPath) return null;
  return `npx supabase gen types typescript --project-id ${repo.supabaseProjectId} > ${repo.supabaseTypesPath}`;
}

// ---------------------------------------------------------------------------
// REST API helpers (no @supabase/supabase-js dependency needed)
// ---------------------------------------------------------------------------

/**
 * Execute a SQL query via Supabase REST API.
 * Requires the `exec_sql` RPC function to exist in the target project.
 */
export async function execSql(
  creds: SupabaseCredentials,
  sql: string,
): Promise<{ data: unknown; error: string | null }> {
  try {
    const res = await fetch(`${creds.url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: creds.serviceRoleKey,
        Authorization: `Bearer ${creds.serviceRoleKey}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!res.ok) {
      return { data: null, error: `HTTP ${res.status}: ${await res.text()}` };
    }

    const data = await res.json();
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Query a Supabase table via REST API (PostgREST).
 */
export async function queryTable(
  creds: SupabaseCredentials,
  table: string,
  queryParams: string = '',
): Promise<{ data: unknown[]; error: string | null }> {
  try {
    const url = `${creds.url}/rest/v1/${table}${queryParams ? `?${queryParams}` : ''}`;
    const res = await fetch(url, {
      headers: {
        apikey: creds.serviceRoleKey,
        Authorization: `Bearer ${creds.serviceRoleKey}`,
      },
    });

    if (!res.ok) {
      return { data: [], error: `HTTP ${res.status}: ${await res.text()}` };
    }

    const data = await res.json();
    return { data: Array.isArray(data) ? data : [data], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : String(err) };
  }
}
