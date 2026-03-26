/**
 * Core type system for UGWTF orchestrator, agents, clusters, and swarms.
 */

// ---------------------------------------------------------------------------
// Agent — the atomic unit of work
// ---------------------------------------------------------------------------

export type AgentStatus = 'idle' | 'running' | 'success' | 'failed' | 'skipped';

export type FindingSeverity = 'error' | 'warning' | 'info';

export interface AgentFinding {
  severity: FindingSeverity;
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

export interface AgentResult {
  agentId: string;
  status: AgentStatus;
  repo: string;
  duration: number;
  message: string;
  artifacts: string[];
  findings?: AgentFinding[];
  error?: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  /** Which cluster this agent belongs to */
  clusterId: string;
  /** Execute the agent's work against a single repo */
  execute(ctx: AgentContext): Promise<AgentResult>;
  /** Check if this agent should run for a given repo */
  shouldRun(ctx: AgentContext): boolean;
}

export interface AgentContext {
  repoAlias: string;
  repoSlug: string;
  github: GitHubClient;
  localPath: string;
  dryRun: boolean;
  logger: Logger;
  /** Extra key-value options from CLI (e.g., path) */
  extras: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Cluster — a group of related agents
// ---------------------------------------------------------------------------

export interface Cluster {
  id: string;
  name: string;
  description: string;
  /** Ordered list of agents in this cluster */
  agents: Agent[];
  /** Dependencies: cluster IDs that must complete first */
  dependsOn: string[];
}

// ---------------------------------------------------------------------------
// Swarm — parallel execution of clusters across repos
// ---------------------------------------------------------------------------

export type SwarmMode = 'parallel' | 'sequential' | 'fan-out';

export interface SwarmConfig {
  mode: SwarmMode;
  /** Max concurrent repo operations (only for parallel/fan-out) */
  concurrency: number;
  /** Which repos to target (aliases). Empty = all */
  repos: string[];
  /** Which clusters to run (IDs). Empty = all */
  clusters: string[];
  dryRun: boolean;
  /** Extra key-value options from CLI (e.g., path) */
  extras?: Record<string, string>;
}

export interface SwarmResult {
  mode: SwarmMode;
  startedAt: number;
  completedAt: number;
  results: RepoSwarmResult[];
  summary: SwarmSummary;
}

export interface RepoSwarmResult {
  repo: string;
  clusterResults: ClusterResult[];
}

export interface ClusterResult {
  clusterId: string;
  status: AgentStatus;
  agentResults: AgentResult[];
  duration: number;
}

export interface SwarmSummary {
  totalAgents: number;
  succeeded: number;
  failed: number;
  skipped: number;
  duration: number;
}

// ---------------------------------------------------------------------------
// Orchestrator commands
// ---------------------------------------------------------------------------

export type OrchestratorCommand =
  // Primary pipeline (e2e orchestration)
  | 'prompts'     // Scan, validate, forecast, and create issues from .prompt.md files
  | 'issues'      // Create/manage issues
  | 'prs'         // Review/manage PRs
  | 'chain'       // Manage prompt-chain lifecycle: load, create issues, advance
  // Setup (one-time per repo)
  | 'install'     // Sync labels + deploy workflows (alias: deploy)
  | 'deploy'      // Backward-compatible alias for install
  | 'labels'      // Sync GitHub labels
  // Quality & Support
  | 'validate'    // Check repo state against expected
  | 'fix'         // Auto-fix drift
  | 'audit'       // Full audit of all repos
  | 'status'      // Show current state
  | 'checks'      // Run quality gates for a repo (tsc, lint, build, test)
  | 'generate-chain' // Auto-generate prompt-chain.json from scanned prompts
  // Domain scans
  | 'scan'        // Run all domain-scan clusters (fsd, security, a11y, etc.)
  | 'security'    // Security scanning + secret leak detection
  | 'performance' // Bundle size + heavy dependency detection
  | 'a11y'        // Accessibility validation
  | 'seo'         // SEO meta tags, sitemaps
  | 'docs'        // Documentation coverage
  | 'commerce'    // E-commerce feature validation
  // 40x wave
  | 'scenarios'   // User flow discovery + acceptance criteria coverage
  | 'design-system' // Design tokens, component contracts, responsive audit
  | 'supabase'    // Migration safety, RLS, type freshness, query patterns
  | 'gateway';    // Prompt validation, instruction scoring, token budgets

export type OutputFormat = 'json' | 'markdown' | 'summary';

export interface OrchestratorOptions {
  command: OrchestratorCommand;
  repos: string[];
  clusters: string[];
  dryRun: boolean;
  verbose: boolean;
  concurrency: number;
  output?: OutputFormat;
  /** G52: enable watch mode — re-run on file changes */
  watch?: boolean;
  /** Skip repo-unchanged cache — force all repos to run */
  noCache?: boolean;
  /** Extra key-value options passed to agents (e.g., --path) */
  extras?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// GitHub API types (subset we actually use)
// ---------------------------------------------------------------------------

export interface GitHubClient {
  /** Create or update a label */
  syncLabel(owner: string, repo: string, label: { name: string; color: string; description: string }): Promise<void>;
  /** List all labels */
  listLabels(owner: string, repo: string): Promise<Array<{ name: string; color: string; description: string }>>;
  /** Delete a label */
  deleteLabel(owner: string, repo: string, name: string): Promise<void>;
  /** List issues */
  listIssues(owner: string, repo: string, state?: 'open' | 'closed' | 'all', labels?: string[]): Promise<GitHubIssue[]>;
  /** Create an issue */
  createIssue(owner: string, repo: string, issue: { title: string; body: string; labels: string[] }): Promise<GitHubIssue>;
  /** Add comment to issue/PR */
  addComment(owner: string, repo: string, issueNumber: number, body: string): Promise<void>;
  /** List PRs */
  listPRs(owner: string, repo: string, state?: 'open' | 'closed' | 'all'): Promise<GitHubPR[]>;
  /** Get PR files changed */
  getPRFiles(owner: string, repo: string, prNumber: number): Promise<GitHubFile[]>;
  /** Add labels to issue/PR */
  addLabels(owner: string, repo: string, issueNumber: number, labels: string[]): Promise<void>;
  /** Remove label from issue/PR */
  removeLabel(owner: string, repo: string, issueNumber: number, label: string): Promise<void>;
  /** Assign user to issue */
  assignIssue(owner: string, repo: string, issueNumber: number, assignees: string[]): Promise<void>;
  /** Assign Copilot to issue — forces fetch transport (gh CLI silently fails for Copilot) */
  assignCopilot(owner: string, repo: string, issueNumber: number): Promise<void>;
  /** Get a single issue by number */
  getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue>;
  /** Close an issue with state_reason: completed */
  closeIssue(owner: string, repo: string, issueNumber: number): Promise<void>;
  /** List workflow runs */
  listWorkflowRuns(owner: string, repo: string): Promise<GitHubWorkflowRun[]>;
  /** Get file contents from repo */
  getFileContents(owner: string, repo: string, path: string): Promise<string>;
  /** List branches */
  listBranches(owner: string, repo: string): Promise<Array<{ name: string; commit: { sha: string } }>>;
  /** Check rate limit */
  getRateLimit(): Promise<{ remaining: number; limit: number; reset: number }>;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: Array<{ name: string }>;
  assignees: Array<{ login: string }>;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubPR {
  number: number;
  title: string;
  body: string;
  state: string;
  draft: boolean;
  labels: Array<{ name: string }>;
  head: { ref: string; sha: string };
  base: { ref: string };
  html_url: string;
  user: { login: string };
  created_at: string;
  updated_at: string;
}

export interface GitHubFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Plugin system
// ---------------------------------------------------------------------------

/**
 * Plugin interface for extending UGWTF.
 * Plugins are loaded from `node_modules/@ugwtf/*` packages that declare
 * `"ugwtf-plugin": true` in their `package.json`.
 */
export interface UGWTFPlugin {
  name: string;
  version: string;
  /** Called once during startup to register clusters, agents, and commands. */
  register(registry: PluginRegistry): void;
}

/** Registry provided to plugins during registration. */
export interface PluginRegistry {
  /** Register a new cluster. */
  addCluster(cluster: Cluster): void;
  /** Add an agent to an existing or new cluster. */
  addAgent(clusterId: string, agent: Agent): void;
  /** Register a new CLI command mapped to cluster IDs. */
  addCommand(name: string, clusterIds: string[]): void;
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  success(msg: string): void;
  debug(msg: string): void;
  group(label: string): void;
  groupEnd(): void;
}
