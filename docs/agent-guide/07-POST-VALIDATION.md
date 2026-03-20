# UGWTF — Post-Validation Pipeline

After every command execution, UGWTF produces 3 outputs.

## Output Flow

```
Agent Execution → SwarmResult
  ├── scoreboard.ts   → .ugwtf/SCOREBOARD.json + SCOREBOARD.md
  ├── persist.ts      → .ugwtf/last-run.json
  └── json-reporter.ts → .ugwtf/reports/<timestamp>.json
```

## 1. Scoreboard (`src/output/scoreboard.ts`)

**What**: Per-repo health scores with trend tracking.  
**Output**: `.ugwtf/SCOREBOARD.json` + `.ugwtf/SCOREBOARD.md`

```typescript
interface Scoreboard {
  generatedAt: string;
  overallScore: number;        // avg of all repo scores
  previousScore: number | null;
  trend: 'up' | 'down' | 'stable';
  repos: RepoScore[];
}

interface RepoScore {
  name: string;
  score: number;   // (passed / total) * 100
  passed: number;
  failed: number;
  skipped: number;
}
```

**Trend icons**: >=80% → ✅ | >=60% → 🟡 | <60% → 🔴  
**Target**: 80%+ per repo

## 2. Last Run Persistence (`src/output/persist.ts`)

**What**: Quick-check summary for `ugwtf status`.  
**Output**: `.ugwtf/last-run.json`

```typescript
interface LastRunData {
  command: string;
  timestamp: string;
  duration: number;       // ms
  summary: {
    totalAgents: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
  repos: string[];
  failedAgents: string[];  // agent IDs that failed
}
```

## 3. JSON Reporter (`src/output/json-reporter.ts`)

**What**: Full execution trace for debugging.  
**Output**: `.ugwtf/reports/<YYYY-MM-DDTHH-MM-SS>.json`

Contains per-repo → per-cluster → per-agent breakdown with:
- Agent status (pass/fail/warn/skip)
- Findings array
- Error messages
- Artifacts produced

## Reading Post-Validation Data

```bash
# Quick status check (reads last-run.json)
npx tsx src/index.ts status damieus

# View scoreboard
cat .ugwtf/SCOREBOARD.md

# View latest report
ls -lt .ugwtf/reports/ | head -2
cat .ugwtf/reports/<latest>.json | jq '.repos[0].clusters[0].agents[0]'
```
