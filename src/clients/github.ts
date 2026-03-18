/**
 * GitHub API client — executes real `gh` CLI calls (async).
 *
 * Uses the `gh` CLI (which handles auth via GITHUB_TOKEN or gh auth).
 * Every method shells out to `gh api` for predictable, auditable calls.
 *
 * Features:
 * - Non-blocking async execution (child_process.execFile)
 * - In-memory GET response cache within a single run
 * - Rate-limit awareness with automatic backoff
 */
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { GitHubClient, GitHubIssue, GitHubPR, GitHubFile, GitHubWorkflowRun, Logger } from '../types.js';

const execFileAsync = promisify(execFile);

/** Simple in-memory cache for GET requests within a single run. */
interface CacheEntry { data: string; timestamp: number }

const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Create a GitHub API client backed by the `gh` CLI with in-memory caching.
 *
 * @param logger - Logger for request/response tracing.
 * @param dryRun - When `true`, mutating calls are skipped.
 * @returns A {@link GitHubClient} facade.
 */
export function createGitHubClient(logger: Logger, dryRun = false): GitHubClient {
  const cache = new Map<string, CacheEntry>();
  let rateLimitRemaining = Infinity;

  async function ghApi(method: string, path: string, body?: Record<string, unknown>): Promise<string> {
    // Rate-limit guard: if remaining is critically low, back off
    if (rateLimitRemaining < 10 && rateLimitRemaining !== Infinity) {
      const waitMs = 5_000;
      logger.warn(`Rate limit low (${rateLimitRemaining} remaining) — waiting ${waitMs}ms`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }

    // GET cache: return cached response if fresh
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

    logger.debug(`gh api ${method} ${path}`);

    try {
      let result: string;

      if (body && Object.values(body).some(v => typeof v !== 'string')) {
        // Complex body: pipe JSON via stdin using spawn
        result = await new Promise<string>((resolve, reject) => {
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
      } else {
        // Simple body: use -f flags
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
        result = stdout;
      }

      const trimmed = result.trim() || '{}';

      // Cache GET responses
      if (method === 'GET') {
        cache.set(path, { data: trimmed, timestamp: Date.now() });
      }

      // Decrement rate-limit estimate for write operations
      if (method !== 'GET' && rateLimitRemaining !== Infinity) {
        rateLimitRemaining--;
      }

      return trimmed;
    } catch (err) {
      throw err;
    }
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
