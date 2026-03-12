/**
 * GitHub API client — executes real `gh` CLI calls.
 *
 * Uses the `gh` CLI (which handles auth via GITHUB_TOKEN or gh auth).
 * Every method shells out to `gh api` for predictable, auditable calls.
 */
import { execSync } from 'node:child_process';
import type { GitHubClient, GitHubIssue, GitHubPR, GitHubFile, GitHubWorkflowRun, Logger } from '../types.js';

export function createGitHubClient(logger: Logger, dryRun = false): GitHubClient {
  function ghApi(method: string, path: string, body?: Record<string, unknown>): string {
    const args = ['gh', 'api', '-X', method, path];

    if (body) {
      // Pass body as individual -f flags to avoid shell injection
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string') {
          args.push('-f', `${key}=${value}`);
        } else {
          args.push('--input', '-');
        }
      }
    }

    const cmd = args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ');

    if (dryRun) {
      logger.debug(`[DRY RUN] ${method} ${path}`);
      return '{}';
    }

    logger.debug(`gh api ${method} ${path}`);

    try {
      let result: string;
      if (body && Object.values(body).some(v => typeof v !== 'string')) {
        result = execSync(`gh api -X ${method} ${path} --input -`, {
          input: JSON.stringify(body),
          encoding: 'utf-8',
          timeout: 30_000,
          maxBuffer: 10 * 1024 * 1024,
        });
      } else {
        result = execSync(cmd, { encoding: 'utf-8', timeout: 30_000, shell: '/bin/zsh', maxBuffer: 10 * 1024 * 1024 });
      }
      return result.trim() || '{}';
    } catch (err) {
      throw err;
    }
  }

  /** Like ghApi but returns '{}' on 404 instead of throwing */
  function ghApiSafe404(method: string, path: string, body?: Record<string, unknown>): string {
    try {
      return ghApi(method, path, body);
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
        // Try to update existing label
        ghApi('PATCH', `/repos/${owner}/${repo}/labels/${encodeURIComponent(label.name)}`, {
          color: label.color,
          description: label.description,
        });
        logger.debug(`Updated label: ${label.name}`);
      } catch {
        // Label doesn't exist — create it
        ghApi('POST', `/repos/${owner}/${repo}/labels`, {
          name: label.name,
          color: label.color,
          description: label.description,
        });
        logger.debug(`Created label: ${label.name}`);
      }
    },

    async listLabels(owner, repo) {
      const raw = ghApi('GET', `/repos/${owner}/${repo}/labels?per_page=100`);
      return parseJSONArray<{ name: string; color: string; description: string }>(raw);
    },

    async deleteLabel(owner, repo, name) {
      ghApiSafe404('DELETE', `/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`);
    },

    async listIssues(owner, repo, state = 'open', labels) {
      const labelParam = labels?.length ? `&labels=${labels.join(',')}` : '';
      const raw = ghApi('GET', `/repos/${owner}/${repo}/issues?state=${state}&per_page=100${labelParam}`);
      return parseJSONArray<GitHubIssue>(raw);
    },

    async createIssue(owner, repo, issue) {
      const raw = ghApi('POST', `/repos/${owner}/${repo}/issues`, {
        title: issue.title,
        body: issue.body,
        labels: issue.labels as unknown as string,
      });
      return parseJSON<GitHubIssue>(raw);
    },

    async addComment(owner, repo, issueNumber, body) {
      ghApi('POST', `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { body });
    },

    async listPRs(owner, repo, state = 'open') {
      const raw = ghApi('GET', `/repos/${owner}/${repo}/pulls?state=${state}&per_page=100`);
      return parseJSONArray<GitHubPR>(raw);
    },

    async getPRFiles(owner, repo, prNumber) {
      const raw = ghApi('GET', `/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`);
      return parseJSONArray<GitHubFile>(raw);
    },

    async addLabels(owner, repo, issueNumber, labels) {
      ghApi('POST', `/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
        labels: labels as unknown as string,
      });
    },

    async removeLabel(owner, repo, issueNumber, label) {
      ghApiSafe404('DELETE', `/repos/${owner}/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`);
    },

    async assignIssue(owner, repo, issueNumber, assignees) {
      ghApi('POST', `/repos/${owner}/${repo}/issues/${issueNumber}/assignees`, {
        assignees: assignees as unknown as string,
      });
    },

    async getFileContents(owner, repo, path) {
      if (dryRun) return '';
      const raw = ghApi('GET', `/repos/${owner}/${repo}/contents/${path}`);
      const parsed = parseJSON<{ content?: string }>(raw);
      if (!parsed.content) throw new Error(`File not found: ${path}`);
      return Buffer.from(parsed.content, 'base64').toString('utf-8');
    },

    async listWorkflowRuns(owner, repo) {
      const raw = ghApi('GET', `/repos/${owner}/${repo}/actions/runs?per_page=10`);
      const parsed = parseJSON<{ workflow_runs?: GitHubWorkflowRun[] }>(raw);
      return parsed.workflow_runs ?? [];
    },

    async listBranches(owner, repo) {
      const raw = ghApi('GET', `/repos/${owner}/${repo}/branches?per_page=100`);
      return parseJSONArray<{ name: string; commit: { sha: string } }>(raw);
    },

    async getRateLimit() {
      if (dryRun) return { remaining: 5000, limit: 5000, reset: 0 };
      const raw = ghApi('GET', '/rate_limit');
      const parsed = parseJSON<{ rate?: { remaining: number; limit: number; reset: number } }>(raw);
      return parsed.rate ?? { remaining: 0, limit: 0, reset: 0 };
    },
  };
}
