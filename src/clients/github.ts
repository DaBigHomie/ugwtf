/**
 * GitHub API client — dual transport: `gh` CLI (preferred) or `fetch` fallback.
 *
 * Transport selection (automatic at first API call):
 * 1. If `gh` is on PATH → uses `gh api` subprocess (handles auth via gh auth)
 * 2. If `gh` is unavailable → falls back to native `fetch` + `GITHUB_TOKEN` env var
 *
 * Features:
 * - Non-blocking async execution (child_process.execFile or fetch)
 * - In-memory GET response cache within a single run
 * - Rate-limit awareness with automatic backoff
 * - Zero external dependencies (Node 18+ native fetch)
 */
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { GitHubClient, GitHubIssue, GitHubPR, GitHubFile, GitHubWorkflowRun, Logger } from '../types.js';

const execFileAsync = promisify(execFile);

/** Simple in-memory cache for GET requests within a single run. */
interface CacheEntry { data: string; timestamp: number }

const CACHE_TTL_MS = 60_000; // 1 minute
const GITHUB_API_BASE = 'https://api.github.com';

type Transport = 'gh' | 'fetch';

/** Check if `gh` CLI is available on PATH. Cached per process. */
let ghAvailable: boolean | null = null;
async function isGhAvailable(): Promise<boolean> {
  if (ghAvailable !== null) return ghAvailable;
  try {
    await execFileAsync('gh', ['--version'], { timeout: 5_000 });
    ghAvailable = true;
  } catch {
    ghAvailable = false;
  }
  return ghAvailable;
}

/** Exported for testing — reset the cached transport probe. */
export function resetTransportCache(): void {
  ghAvailable = null;
}

/**
 * Create a GitHub API client with automatic transport selection.
 *
 * Prefers `gh` CLI when available; falls back to native `fetch` + `GITHUB_TOKEN`.
 *
 * @param logger - Logger for request/response tracing.
 * @param dryRun - When `true`, mutating calls are skipped.
 * @returns A {@link GitHubClient} facade.
 */
export function createGitHubClient(logger: Logger, dryRun = false): GitHubClient {
  const cache = new Map<string, CacheEntry>();
  let rateLimitRemaining = Infinity;
  let resolvedTransport: Transport | null = null;

  /** Resolve transport once, on first API call. */
  async function getTransport(): Promise<Transport> {
    if (resolvedTransport) return resolvedTransport;
    const hasGh = await isGhAvailable();
    if (hasGh) {
      resolvedTransport = 'gh';
      logger.debug('[TRANSPORT] Using gh CLI');
    } else {
      const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
      if (!token) {
        throw new Error(
          'gh CLI not found and no GITHUB_TOKEN set. ' +
          'Install gh (https://cli.github.com) or export GITHUB_TOKEN.'
        );
      }
      resolvedTransport = 'fetch';
      logger.warn('[TRANSPORT] gh CLI not found — using fetch + GITHUB_TOKEN');
    }
    return resolvedTransport;
  }

  // -- Transport: gh CLI ---------------------------------------------------

  async function ghCliApi(method: string, path: string, body?: Record<string, unknown>): Promise<string> {
    if (body && Object.values(body).some(v => typeof v !== 'string')) {
      return new Promise<string>((resolve, reject) => {
        const proc = spawn('gh', ['api', '-X', method, path, '--input', '-'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 30_000,
        });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
        proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
        proc.on('close', (code) => {
          if (code === 0) resolve(stdout);
          else reject(new Error(`gh api failed (${code}): ${stderr}`));
        });
        proc.on('error', reject);
        proc.stdin.end(JSON.stringify(body));
      });
    }
    const args = ['api', '-X', method, path];
    if (body) {
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string') {
          args.push('-f', `${key}=${value}`);
        }
      }
    }
    const { stdout } = await execFileAsync('gh', args, {
      encoding: 'utf-8',
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  }

  // -- Transport: native fetch ---------------------------------------------

  async function fetchApi(method: string, path: string, body?: Record<string, unknown>): Promise<string> {
    const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '';
    const url = path.startsWith('http') ? path : `${GITHUB_API_BASE}${path}`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ugwtf/1.0.0',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const init: RequestInit = { method, headers };
    if (body && method !== 'GET') {
      init.body = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, init);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GitHub API ${method} ${path} failed (${res.status}): ${text}`);
    }
    const text = await res.text();
    return text || '{}';
  }

  // -- Unified API dispatcher ----------------------------------------------

  async function ghApi(method: string, path: string, body?: Record<string, unknown>): Promise<string> {
    if (rateLimitRemaining < 10 && rateLimitRemaining !== Infinity) {
      const waitMs = 5_000;
      logger.warn(`Rate limit low (${rateLimitRemaining} remaining) — waiting ${waitMs}ms`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }

    if (method === 'GET') {
      const cached = cache.get(path);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        logger.debug(`[CACHE HIT] ${path}`);
        return cached.data;
      }
    }

    if (dryRun) {
      logger.debug(`[DRY RUN] ${method} ${path}`);
      return '{}';
    }

    const transport = await getTransport();
    logger.debug(`[${transport}] ${method} ${path}`);

    const result = transport === 'gh'
      ? await ghCliApi(method, path, body)
      : await fetchApi(method, path, body);

    const trimmed = result.trim() || '{}';

    if (method === 'GET') {
      cache.set(path, { data: trimmed, timestamp: Date.now() });
    } else {
      // Invalidate cached GETs that share the resource prefix (e.g. POST /labels invalidates GET /labels?...)
      const pathBase = path.split('?')[0] ?? path;
      const prefix = pathBase.replace(/\/[^/]+$/, '');
      for (const key of cache.keys()) {
        const keyBase = key.split('?')[0] ?? key;
        if (keyBase === pathBase || keyBase.startsWith(prefix + '/') || keyBase === prefix) {
          cache.delete(key);
        }
      }
    }
    if (method !== 'GET' && rateLimitRemaining !== Infinity) {
      rateLimitRemaining--;
    }

    return trimmed;
  }

  /** Like ghApi but returns '{}' on 404 instead of throwing */
  async function ghApiSafe404(method: string, path: string, body?: Record<string, unknown>): Promise<string> {
    try {
      return await ghApi(method, path, body);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('404') || message.includes('Not Found')) {
        return '{}';
      }
      throw err;
    }
  }

  function parseJSON<T>(raw: string): T {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return (Array.isArray([] as unknown as T) ? [] : {}) as T;
    }
  }

  function parseJSONArray<T>(raw: string): T[] {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed as T[] : [];
    } catch {
      return [];
    }
  }

  return {
    async syncLabel(owner, repo, label) {
      try {
        await ghApi('PATCH', `/repos/${owner}/${repo}/labels/${encodeURIComponent(label.name)}`, {
          color: label.color,
          description: label.description,
        });
        logger.debug(`Updated label: ${label.name}`);
      } catch {
        await ghApi('POST', `/repos/${owner}/${repo}/labels`, {
          name: label.name,
          color: label.color,
          description: label.description,
        });
        logger.debug(`Created label: ${label.name}`);
      }
    },

    async listLabels(owner, repo) {
      const raw = await ghApi('GET', `/repos/${owner}/${repo}/labels?per_page=100`);
      return parseJSONArray<{ name: string; color: string; description: string }>(raw);
    },

    async deleteLabel(owner, repo, name) {
      await ghApiSafe404('DELETE', `/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`);
    },

    async listIssues(owner, repo, state = 'open', labels) {
      const labelParam = labels?.length ? `&labels=${labels.join(',')}` : '';
      const raw = await ghApi('GET', `/repos/${owner}/${repo}/issues?state=${state}&per_page=100${labelParam}`);
      return parseJSONArray<GitHubIssue>(raw);
    },

    async createIssue(owner, repo, issue) {
      const raw = await ghApi('POST', `/repos/${owner}/${repo}/issues`, {
        title: issue.title,
        body: issue.body,
        labels: issue.labels as unknown as string,
      });
      return parseJSON<GitHubIssue>(raw);
    },

    async addComment(owner, repo, issueNumber, body) {
      await ghApi('POST', `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { body });
    },

    async listPRs(owner, repo, state = 'open') {
      const raw = await ghApi('GET', `/repos/${owner}/${repo}/pulls?state=${state}&per_page=100`);
      return parseJSONArray<GitHubPR>(raw);
    },

    async getPRFiles(owner, repo, prNumber) {
      const raw = await ghApi('GET', `/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`);
      return parseJSONArray<GitHubFile>(raw);
    },

    async addLabels(owner, repo, issueNumber, labels) {
      await ghApi('POST', `/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
        labels: labels as unknown as string,
      });
    },

    async removeLabel(owner, repo, issueNumber, label) {
      await ghApiSafe404('DELETE', `/repos/${owner}/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`);
    },

    async assignIssue(owner, repo, issueNumber, assignees) {
      await ghApi('POST', `/repos/${owner}/${repo}/issues/${issueNumber}/assignees`, {
        assignees: assignees as unknown as string,
      });
    },

    async assignCopilot(owner, repo, issueNumber) {
      if (dryRun) {
        logger.debug(`[DRY RUN] Would assign Copilot to #${issueNumber}`);
        return;
      }
      // Remove ALL possible Copilot assignee names (display vs bot login)
      for (const name of ['copilot-swe-agent[bot]', 'Copilot', 'copilot']) {
        await ghApiSafe404('DELETE', `/repos/${owner}/${repo}/issues/${issueNumber}/assignees`,
          { assignees: [name] } as unknown as Record<string, string>);
      }

      // Copilot coding agent requires copilot-swe-agent[bot] + agent_assignment
      const payload = {
        assignees: ['copilot-swe-agent[bot]'],
        agent_assignment: {
          target_repo: `${owner}/${repo}`,
          base_branch: 'main',
        },
      };
      const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '';
      if (!token) {
        logger.warn('No GITHUB_TOKEN — falling back to gh CLI for Copilot assignment');
        await ghApi('POST', `/repos/${owner}/${repo}/issues/${issueNumber}/assignees`, payload as unknown as Record<string, string>);
        return;
      }
      const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${issueNumber}/assignees`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
          'User-Agent': 'ugwtf/1.0.0',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Copilot assignment failed (${res.status}): ${text}`);
      }
      logger.debug(`[FETCH] Assigned Copilot to #${issueNumber}`);
    },

    async getIssue(owner, repo, issueNumber) {
      const raw = await ghApi('GET', `/repos/${owner}/${repo}/issues/${issueNumber}`);
      return parseJSON<GitHubIssue>(raw);
    },

    async closeIssue(owner, repo, issueNumber) {
      await ghApi('PATCH', `/repos/${owner}/${repo}/issues/${issueNumber}`, {
        state: 'closed',
        state_reason: 'completed',
      } as Record<string, string>);
    },

    async closePR(owner, repo, prNumber) {
      await ghApi('PATCH', `/repos/${owner}/${repo}/pulls/${prNumber}`, {
        state: 'closed',
      } as Record<string, string>);
    },

    async deleteBranch(owner, repo, branch) {
      await ghApiSafe404('DELETE', `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`);
    },

    async dispatchWorkflow(owner, repo, eventType, payload) {
      await ghApi('POST', `/repos/${owner}/${repo}/dispatches`, {
        event_type: eventType,
        client_payload: payload,
      } as Record<string, unknown>);
    },

    async getFileContents(owner, repo, path) {
      if (dryRun) return '';
      const raw = await ghApi('GET', `/repos/${owner}/${repo}/contents/${path}`);
      const parsed = parseJSON<{ content?: string }>(raw);
      if (!parsed.content) throw new Error(`File not found: ${path}`);
      return Buffer.from(parsed.content, 'base64').toString('utf-8');
    },

    async listWorkflowRuns(owner, repo) {
      const raw = await ghApi('GET', `/repos/${owner}/${repo}/actions/runs?per_page=10`);
      const parsed = parseJSON<{ workflow_runs?: GitHubWorkflowRun[] }>(raw);
      return parsed.workflow_runs ?? [];
    },

    async listBranches(owner, repo) {
      const raw = await ghApi('GET', `/repos/${owner}/${repo}/branches?per_page=100`);
      return parseJSONArray<{ name: string; commit: { sha: string } }>(raw);
    },

    async getRateLimit() {
      if (dryRun) return { remaining: 5000, limit: 5000, reset: 0 };
      const raw = await ghApi('GET', '/rate_limit');
      const parsed = parseJSON<{ rate?: { remaining: number; limit: number; reset: number } }>(raw);
      const rate = parsed.rate ?? { remaining: 0, limit: 0, reset: 0 };
      // Sync internal rate-limit tracking
      rateLimitRemaining = rate.remaining;
      return rate;
    },
  };
}
