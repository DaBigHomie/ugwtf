#!/usr/bin/env node
/**
 * UGWTF CLI Entry Point
 *
 * Usage:
 *   ugwtf <command> [repos...] [options]
 *
 * Commands:
 *   deploy   — Write workflows + sync labels to repos
 *   validate — Run quality checks (tsc, lint, build)
 *   fix      — Auto-fix labels, workflows, and quality
 *   labels   — Sync GitHub labels only
 *   issues   — Detect stalled issues, assign Copilot, auto-triage
 *   prs      — Review Copilot PRs, enforce DB firewall
 *   audit    — Full audit of all repos with scoreboard
 *   status   — Quick health check
 *   prompts  — Scan, validate, and create issues from .prompt.md files
 *   chain    — Manage prompt-chain lifecycle (load, create issues, advance)
 *
 * Options:
 *   --dry-run        Don't make any changes
 *   --verbose        Show debug output
 *   --concurrency N  Max parallel repos (default: 3)
 *   --cluster ID     Run specific cluster(s) (can repeat)
 *   --output FMT    Output format: json, markdown, summary
 *
 * Examples:
 *   ugwtf deploy damieus ffs
 *   ugwtf audit --dry-run
 *   ugwtf prs damieus --verbose
 *   ugwtf labels --concurrency 5
 */
import type { OrchestratorCommand, OrchestratorOptions, OutputFormat } from './types.js';
import { orchestrate } from './orchestrator.js';
import { allAliases, registerReposFromRC, type RepoConfig } from './config/repo-registry.js';
import { scaffoldAgent, parseNewAgentArgs } from './scaffold/new-agent.js';
import { scaffoldRepo, parseNewRepoArgs } from './scaffold/new-repo.js';
import { listCommand, parseListArgs } from './commands/list.js';
import { runAgentCommand, parseRunAgentArgs } from './commands/run-agent.js';
import { loadRC } from './config/rc-loader.js';

const SCAFFOLD_COMMANDS = ['new-agent', 'new-repo'] as const;
type ScaffoldCommand = typeof SCAFFOLD_COMMANDS[number];

const UTILITY_COMMANDS = ['list', 'run'] as const;
type UtilityCommand = typeof UTILITY_COMMANDS[number];

const VALID_COMMANDS: OrchestratorCommand[] = [
  'deploy', 'validate', 'fix', 'labels', 'issues', 'prs', 'audit', 'status', 'prompts', 'chain',
  'scan', 'security', 'performance', 'a11y', 'seo', 'docs', 'commerce',
  'scenarios', 'design-system', 'supabase', 'gateway',
];

function printUsage(): void {
  console.log(`
  UGWTF — Unified GitHub Workflow & Task Framework

  Usage: ugwtf <command> [repos...] [options]

  Commands:
    deploy     Write workflows + sync labels to repos
    validate   Run quality checks (tsc, lint, build)
    fix        Auto-fix labels, workflows, and quality
    labels     Sync GitHub labels only
    issues     Detect stalled issues, assign Copilot, auto-triage
    prs        Review Copilot PRs, enforce DB firewall
    audit      Full audit of all repos with scoreboard
    status     Quick health check
    prompts    Scan, validate, and create issues from .prompt.md files
    chain      Manage prompt-chain lifecycle (load, create issues, advance)
    scan       Run all domain-scan clusters (fsd, security, a11y, etc.)
    security   Security scanning + secret leak detection
    performance Bundle size + heavy dependency detection
    a11y       Accessibility validation
    seo        SEO meta tags, sitemaps
    docs       Documentation coverage
    commerce   E-commerce feature validation
    scenarios  User flow discovery + acceptance criteria coverage
    design-system  Design tokens, component contracts, responsive audit
    supabase   Migration safety, RLS, type freshness, query patterns
    gateway    Prompt validation, instruction scoring, token budgets

  Scaffold:
    new-agent  Generate agent boilerplate (ugwtf new-agent <id> --cluster <cid>)
    new-repo   Generate repo config entry (ugwtf new-repo <alias> --slug O/R --framework fw)

  Utility:
    list       Show all clusters, agents, and repos (ugwtf list [clusters|agents|repos])
    run        Execute a single agent (ugwtf run <agent-id> [repos...] [--dry-run])

  Options:
    --dry-run        Don't make any changes
    --verbose, -v    Show debug output
    --concurrency N  Max parallel repos (default: 3)
    --cluster ID     Run specific cluster(s) (repeatable)
    --output FMT     Output format: json, markdown, summary (default: summary)
    --help, -h       Show this help

  Repos: ${allAliases().join(', ')}

  Examples:
    ugwtf deploy damieus ffs
    ugwtf audit --dry-run
    ugwtf prs damieus --verbose
    ugwtf labels --concurrency 5
`);
}

/**
 * Parse CLI arguments into {@link OrchestratorOptions}.
 *
 * @param argv - Raw `process.argv` array.
 * @returns Parsed options, or `null` if `--help` was requested.
 */
export function parseArgs(argv: string[]): OrchestratorOptions | null {
  // Skip node and script path
  const args = argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    return null;
  }

  const command = args[0];
  if (!VALID_COMMANDS.includes(command as OrchestratorCommand)) {
    console.error(`Unknown command: ${command}`);
    console.error(`Valid commands: ${VALID_COMMANDS.join(', ')}`);
    process.exit(1);
  }

  const repos: string[] = [];
  const clusters: string[] = [];
  let dryRun = false;
  let verbose = false;
  let concurrency = 3;
  let output: OutputFormat | undefined;

  const knownAliases = new Set(allAliases());
  const validOutputFormats: OutputFormat[] = ['json', 'markdown', 'summary'];

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg === '--concurrency') {
      i++;
      const rawVal = args[i];
      const val = rawVal ? parseInt(rawVal) : NaN;
      if (isNaN(val) || val < 1) {
        console.error('--concurrency requires a positive integer');
        process.exit(1);
      }
      concurrency = val;
    } else if (arg === '--cluster') {
      i++;
      const clusterId = args[i];
      if (!clusterId) {
        console.error('--cluster requires a cluster ID');
        process.exit(1);
      }
      clusters.push(clusterId);
    } else if (arg === '--output') {
      i++;
      const fmt = args[i] as OutputFormat | undefined;
      if (!fmt || !validOutputFormats.includes(fmt)) {
        console.error(`--output requires one of: ${validOutputFormats.join(', ')}`);
        process.exit(1);
      }
      output = fmt;
    } else if (arg?.startsWith('--')) {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    } else if (arg && knownAliases.has(arg)) {
      repos.push(arg);
    } else {
      console.error(`Unknown repo alias: ${arg}`);
      console.error(`Known aliases: ${Array.from(knownAliases).join(', ')}`);
      process.exit(1);
    }
  }

  return {
    command: command as OrchestratorCommand,
    repos,
    clusters,
    dryRun,
    verbose,
    concurrency,
    output,
  };
}

async function main(): Promise<void> {
  // Handle scaffold commands separately (no swarm execution needed)
  const rawArgs = process.argv.slice(2);
  const firstArg = rawArgs[0];

  if (firstArg && SCAFFOLD_COMMANDS.includes(firstArg as ScaffoldCommand)) {
    const subArgs = rawArgs.slice(1);
    switch (firstArg as ScaffoldCommand) {
      case 'new-agent': {
        const opts = parseNewAgentArgs(subArgs);
        if (opts) scaffoldAgent(opts);
        return;
      }
      case 'new-repo': {
        const opts = parseNewRepoArgs(subArgs);
        if (opts) scaffoldRepo(opts);
        return;
      }
    }
  }

  // Handle utility commands (list, run)
  if (firstArg && UTILITY_COMMANDS.includes(firstArg as UtilityCommand)) {
    const subArgs = rawArgs.slice(1);
    switch (firstArg as UtilityCommand) {
      case 'list': {
        const target = parseListArgs(subArgs);
        if (target) listCommand(target);
        return;
      }
      case 'run': {
        const opts = parseRunAgentArgs(subArgs);
        if (opts) await runAgentCommand(opts);
        return;
      }
    }
  }

  const options = parseArgs(process.argv);
  if (!options) {
    process.exit(0);
  }

  // Merge .ugwtfrc.json defaults (CLI flags take precedence)
  const rc = loadRC();

  // G48: Register external repos from RC config
  if (rc.repos?.length) {
    registerReposFromRC(rc.repos as Partial<RepoConfig>[]);
  }

  if (options.repos.length === 0 && rc.defaultRepos?.length) {
    options.repos = rc.defaultRepos;
  }
  if (!options.output && rc.output) options.output = rc.output;
  if (!options.verbose && rc.verbose) options.verbose = rc.verbose;
  if (!options.dryRun && rc.dryRun) options.dryRun = rc.dryRun;
  if (options.concurrency === 3 && rc.concurrency !== undefined) {
    options.concurrency = rc.concurrency;
  }

  try {
    const result = await orchestrate(options);
    process.exit(result.summary.failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal error:', err instanceof Error ? err.message : String(err));
    process.exit(2);
  }
}

// Only run when executed directly (not imported by tests)
const isDirectRun = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (isDirectRun) {
  main();
}
