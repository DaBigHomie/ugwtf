/**
 * Mock GitHub client for testing.
 * All methods return safe defaults and record calls for assertions.
 */
import type { GitHubClient, GitHubIssue, GitHubPR, GitHubFile, GitHubWorkflowRun } from '../types.js';

export function createMockGitHubClient(): GitHubClient & { calls: Array<{ method: string; args: unknown[] }> } {
  const calls: Array<{ method: string; args: unknown[] }> = [];

  function track(method: string, args: unknown[]) {
    calls.push({ method, args });
  }

  return {
    calls,

    async syncLabel(owner, repo, label) {
      track('syncLabel', [owner, repo, label]);
    },

    async listLabels(owner, repo) {
      track('listLabels', [owner, repo]);
      return [] as Array<{ name: string; color: string; description: string }>;
    },

    async deleteLabel(owner, repo, name) {
      track('deleteLabel', [owner, repo, name]);
    },

    async listIssues(owner, repo, state?, labels?) {
      track('listIssues', [owner, repo, state, labels]);
      return [] as GitHubIssue[];
    },

    async createIssue(owner, repo, issue) {
      track('createIssue', [owner, repo, issue]);
      return {
        number: 1,
        title: issue.title,
        body: issue.body,
        state: 'open',
        labels: issue.labels.map(l => ({ name: l })),
        assignees: [],
        html_url: `https://github.com/${owner}/${repo}/issues/1`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as GitHubIssue;
    },

    async addComment(owner, repo, issueNumber, body) {
      track('addComment', [owner, repo, issueNumber, body]);
    },

    async listPRs(owner, repo, state?) {
      track('listPRs', [owner, repo, state]);
      return [] as GitHubPR[];
    },

    async getPRFiles(owner, repo, prNumber) {
      track('getPRFiles', [owner, repo, prNumber]);
      return [] as GitHubFile[];
    },

    async addLabels(owner, repo, issueNumber, labels) {
      track('addLabels', [owner, repo, issueNumber, labels]);
    },

    async removeLabel(owner, repo, issueNumber, label) {
      track('removeLabel', [owner, repo, issueNumber, label]);
    },

    async assignIssue(owner, repo, issueNumber, assignees) {
      track('assignIssue', [owner, repo, issueNumber, assignees]);
    },

    async assignCopilot(owner, repo, issueNumber) {
      track('assignCopilot', [owner, repo, issueNumber]);
    },

    async getIssue(owner, repo, issueNumber) {
      track('getIssue', [owner, repo, issueNumber]);
      return {
        number: issueNumber,
        title: '',
        body: '',
        state: 'open',
        labels: [],
        assignees: [{ login: 'copilot' }],
        html_url: `https://github.com/${owner}/${repo}/issues/${issueNumber}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as GitHubIssue;
    },

    async listWorkflowRuns(owner, repo) {
      track('listWorkflowRuns', [owner, repo]);
      return [] as GitHubWorkflowRun[];
    },

    async getFileContents(owner, repo, path) {
      track('getFileContents', [owner, repo, path]);
      return '';
    },

    async listBranches(owner, repo) {
      track('listBranches', [owner, repo]);
      return [] as Array<{ name: string; commit: { sha: string } }>;
    },

    async getRateLimit() {
      track('getRateLimit', []);
      return { remaining: 5000, limit: 5000, reset: Math.floor(Date.now() / 1000) + 3600 };
    },
  };
}
