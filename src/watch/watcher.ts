/**
 * Watch Mode (G52 + G54)
 *
 * Monitors registered repos for file changes using Node.js `fs.watch`
 * (recursive). When changes are detected, emits events and optionally
 * triggers targeted re-runs of the orchestrator.
 *
 * Events are emitted via a simple EventEmitter:
 *   - 'change' — { repo, file, eventType }
 *   - 'trigger' — { repo, command } (before re-run)
 *   - 'complete' — { repo, command, result }
 *   - 'error' — { repo, error }
 */
import { watch, type FSWatcher, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { EventEmitter } from 'node:events';
import type { OrchestratorOptions, Logger, SwarmResult } from '../types.js';
import { orchestrate } from '../orchestrator.js';
import { getRepo, allAliases } from '../config/repo-registry.js';
import { createLogger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileChangeEvent {
  repo: string;
  file: string;
  eventType: 'rename' | 'change';
}

export interface WatchTriggerEvent {
  repo: string;
  command: string;
}

export interface WatchCompleteEvent {
  repo: string;
  command: string;
  result: SwarmResult;
}

export interface WatchErrorEvent {
  repo: string;
  error: Error;
}

export interface WatchOptions {
  /** The orchestrator command to re-run on changes (default: 'validate') */
  command: OrchestratorOptions['command'];
  /** Debounce interval in ms (default: 1000) */
  debounceMs: number;
  /** Verbose logging */
  verbose: boolean;
  /** Dry-run mode for the re-run */
  dryRun: boolean;
  /** Concurrency for the re-run */
  concurrency: number;
  /** Which repos to watch (aliases). Empty = all */
  repos: string[];
  /** Clusters to target on re-run */
  clusters: string[];
}

// Patterns to ignore (node_modules, .git, build artifacts, etc.)
const IGNORE_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /dist\//,
  /\.next\//,
  /\.ugwtf\//,
  /\.turbo\//,
  /coverage\//,
];

function shouldIgnore(filePath: string): boolean {
  return IGNORE_PATTERNS.some(p => p.test(filePath));
}

// ---------------------------------------------------------------------------
// WatchController
// ---------------------------------------------------------------------------

export class WatchController extends EventEmitter {
  private watchers: Map<string, FSWatcher> = new Map();
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private running: Set<string> = new Set();
  private logger: Logger;
  private options: WatchOptions;
  private stopped = false;

  constructor(options: WatchOptions) {
    super();
    this.options = options;
    this.logger = createLogger(options.verbose);
  }

  /**
   * Start watching all configured repos.
   * Returns a list of repos being watched.
   */
  start(): string[] {
    const aliases = this.options.repos.length > 0
      ? this.options.repos
      : allAliases();

    const watched: string[] = [];

    for (const alias of aliases) {
      const repo = getRepo(alias);
      if (!repo?.localPath || !existsSync(repo.localPath)) {
        this.logger.warn(`Skipping ${alias}: no localPath or path does not exist`);
        continue;
      }

      try {
        const watcher = watch(repo.localPath, { recursive: true }, (eventType, filename) => {
          if (this.stopped) return;
          if (!filename || shouldIgnore(filename)) return;

          const event: FileChangeEvent = {
            repo: alias,
            file: filename,
            eventType: eventType as 'rename' | 'change',
          };
          this.emit('change', event);
          this.scheduleRerun(alias);
        });

        watcher.on('error', (err) => {
          const errorEvent: WatchErrorEvent = {
            repo: alias,
            error: err instanceof Error ? err : new Error(String(err)),
          };
          this.emit('error', errorEvent);
        });

        this.watchers.set(alias, watcher);
        watched.push(alias);
        this.logger.info(`Watching: ${alias} (${repo.localPath})`);
      } catch (err) {
        this.logger.error(`Failed to watch ${alias}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (watched.length > 0) {
      this.logger.info('');
      this.logger.info(`Watch mode active — monitoring ${watched.length} repo(s)`);
      this.logger.info(`Command on change: ${this.options.command}`);
      this.logger.info(`Debounce: ${this.options.debounceMs}ms`);
      this.logger.info('Press Ctrl+C to stop');
      this.logger.info('');
    }

    return watched;
  }

  /**
   * Stop all watchers and clear pending timers.
   */
  stop(): void {
    this.stopped = true;
    for (const [alias, watcher] of this.watchers) {
      watcher.close();
      this.logger.debug(`Stopped watching: ${alias}`);
    }
    this.watchers.clear();

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.logger.info('Watch mode stopped');
  }

  /**
   * Schedule a debounced re-run for a specific repo.
   * Multiple rapid changes are coalesced into a single run.
   */
  private scheduleRerun(repoAlias: string): void {
    // Clear existing debounce timer for this repo
    const existing = this.debounceTimers.get(repoAlias);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(repoAlias);
      void this.triggerRerun(repoAlias);
    }, this.options.debounceMs);

    this.debounceTimers.set(repoAlias, timer);
  }

  /**
   * Execute a targeted re-run for a single repo.
   * Skips if a run for this repo is already in progress.
   */
  private async triggerRerun(repoAlias: string): Promise<void> {
    if (this.running.has(repoAlias)) {
      this.logger.debug(`Skipping re-run for ${repoAlias} — already running`);
      return;
    }

    this.running.add(repoAlias);

    const triggerEvent: WatchTriggerEvent = {
      repo: repoAlias,
      command: this.options.command,
    };
    this.emit('trigger', triggerEvent);

    this.logger.info(`\n═══ Re-running ${this.options.command} for ${repoAlias} ═══\n`);

    const orchestratorOptions: OrchestratorOptions = {
      command: this.options.command,
      repos: [repoAlias],
      clusters: this.options.clusters,
      dryRun: this.options.dryRun,
      verbose: this.options.verbose,
      concurrency: this.options.concurrency,
    };

    try {
      const result = await orchestrate(orchestratorOptions);
      const completeEvent: WatchCompleteEvent = {
        repo: repoAlias,
        command: this.options.command,
        result,
      };
      this.emit('complete', completeEvent);
    } catch (err) {
      const errorEvent: WatchErrorEvent = {
        repo: repoAlias,
        error: err instanceof Error ? err : new Error(String(err)),
      };
      this.emit('error', errorEvent);
    } finally {
      this.running.delete(repoAlias);
    }
  }

  /** How many repos are currently being watched */
  get watchCount(): number {
    return this.watchers.size;
  }

  /** Whether any repos are currently running a re-run */
  get isRunning(): boolean {
    return this.running.size > 0;
  }
}

// ---------------------------------------------------------------------------
// Factory — create a WatchController from CLI options
// ---------------------------------------------------------------------------

/**
 * Parse watch-specific arguments from CLI args.
 * Expected: `ugwtf watch [repos...] [--command CMD] [--debounce MS] [flags]`
 */
export function parseWatchArgs(args: string[]): WatchOptions {
  let command: OrchestratorOptions['command'] = 'validate';
  let debounceMs = 1000;
  let verbose = false;
  let dryRun = false;
  let concurrency = 3;
  const repos: string[] = [];
  const clusters: string[] = [];
  const knownAliases = new Set(allAliases());

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--command') {
      i++;
      command = args[i] as OrchestratorOptions['command'];
    } else if (arg === '--debounce') {
      i++;
      debounceMs = parseInt(args[i] ?? '', 10) || 1000;
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--concurrency') {
      i++;
      concurrency = parseInt(args[i] ?? '', 10) || 3;
    } else if (arg === '--cluster') {
      i++;
      const cid = args[i];
      if (cid) clusters.push(cid);
    } else if (arg && !arg.startsWith('--') && knownAliases.has(arg)) {
      repos.push(arg);
    }
  }

  return { command, debounceMs, verbose, dryRun, concurrency, repos, clusters };
}

/**
 * Start watch mode. Returns the controller for programmatic use.
 */
export function startWatch(options: WatchOptions): WatchController {
  const controller = new WatchController(options);
  const watched = controller.start();

  if (watched.length === 0) {
    console.error('No repos to watch — ensure repos have localPath configured');
    process.exit(1);
  }

  // Handle SIGINT gracefully
  process.on('SIGINT', () => {
    controller.stop();
    process.exit(0);
  });

  return controller;
}
