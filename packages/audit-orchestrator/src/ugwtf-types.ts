/**
 * Subset of @dabighomie/ugwtf types used by audit-orchestrator.
 *
 * These mirror the canonical definitions in ugwtf/src/types.ts.
 * Kept in sync automatically — both live in the same repo, so any
 * breaking change is caught by the parent `tsc --noEmit`.
 */

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export type AgentStatus = 'idle' | 'running' | 'success' | 'failed' | 'skipped';

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

export interface AgentFinding {
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

export interface AgentContext {
  repoAlias: string;
  repoSlug: string;
  github: GitHubClient;
  localPath: string;
  dryRun: boolean;
  logger: Logger;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  clusterId: string;
  execute(ctx: AgentContext): Promise<AgentResult>;
  shouldRun(ctx: AgentContext): boolean;
}

// ---------------------------------------------------------------------------
// Cluster
// ---------------------------------------------------------------------------

export interface Cluster {
  id: string;
  name: string;
  description: string;
  agents: Agent[];
  dependsOn: string[];
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export interface UGWTFPlugin {
  name: string;
  version: string;
  register(registry: PluginRegistry): void;
}

export interface PluginRegistry {
  addCluster(cluster: Cluster): void;
  addAgent(clusterId: string, agent: Agent): void;
  addCommand(name: string, clusterIds: string[]): void;
}

// ---------------------------------------------------------------------------
// Minimal external types (structural — no import needed)
// ---------------------------------------------------------------------------

// Structural placeholder — audit-orchestrator never calls github methods directly.
// Must be a supertype of canonical GitHubClient so AgentContext is assignable.
// Using Record<string, unknown> would add an index signature that canonical lacks.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface GitHubClient {}

interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  debug(msg: string): void;
}
