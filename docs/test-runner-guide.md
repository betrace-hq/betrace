# BeTrace Test Runner Guide

## Overview

The BeTrace test runner is a comprehensive testing and coverage monitoring tool built with Nix that provides:
- Unified test execution for both frontend (Vitest) and backend (JUnit/Maven)
- Real-time file watching with automatic test execution
- Coverage tracking with enforced thresholds (90% instruction, 80% branch)
- Beautiful terminal UI with live progress indicators
- Historical tracking and trend analysis
- Desktop notifications
- HTML coverage reports
- **Shell prompt integration** - Test stats displayed in your ZSH prompt

## Shell Prompt Integration

BeTrace includes a custom ZSH prompt theme that displays test statistics directly in your command line.

### What You'll See

Your prompt will look like this:

```zsh
~/Projects/betrace  main ✅ 94/94 89%
➜
```

**Elements:**
- `~/Projects/betrace` - Current directory (blue)
- ` main` - Git branch (green if clean, yellow with `*` if dirty)
- `✅ 94/94 89%` - Test results: passed/total + instruction coverage%
- Or `❌ 2/94` - Failed tests count

### Automatic Setup

The prompt is automatically configured via **direnv** (`.envrc`) or the **dev shell**:

**Option 1: direnv (Recommended)**
```bash
# Install direnv if not already installed
brew install direnv  # macOS
# or: sudo apt install direnv  # Linux

# Allow direnv for this project (one-time)
cd /path/to/betrace
direnv allow

# Prompt is now set up automatically when you cd into the project
```

**Option 2: Dev Shell**
```bash
nix develop
```

On first run, it will:
1. Create `~/.betrace-dev/` directory
2. Install prompt scripts (`prompt-stats.sh`, `betrace-prompt-theme.zsh`)
3. Add configuration to your `~/.zshrc`
4. Source the custom theme in the current shell

### Manual Setup

To reconfigure or troubleshoot:

```bash
nix run .#setup-prompt
source ~/.zshrc
```

### direnv Integration

All `.envrc` files in the project automatically:
- Run setup script on first load (`nix run .#setup-prompt`)
- Source the prompt theme for ZSH shells
- Only activate if ZSH is detected (`$ZSH_VERSION`)

**Project Structure:**
```
.envrc              # Root project (main dev environment)
bff/.envrc          # Frontend-specific environment
backend/.envrc      # Backend-specific environment
```

### How It Works

**Test Stats Script** (`~/.betrace-dev/prompt-stats.sh`):
- Reads test results from `/tmp/betrace-test-results/reports/summary.json`
- Parses coverage from `/tmp/betrace-test-results/coverage/summary.json`
- Only displays stats if results are < 30 minutes old
- Falls back to empty string if no results

**ZSH Theme** (`~/.betrace-dev/betrace-prompt-theme.zsh`):
- Customizes `PROMPT` with `PROMPT_SUBST` enabled
- Calls test stats script on every prompt render
- Color-codes git status and test results
- Optional right-side timestamp

### Customization

Edit `~/.betrace-dev/betrace-prompt-theme.zsh` to customize:

```zsh
# Hide timestamp
RPROMPT=''

# Change colors
PROMPT='%{$fg[cyan]%}%~%{$reset_color%}$(betrace_git_info)$(betrace_test_stats)
%{$fg[green]%}$%{$reset_color%} '

# Adjust test stats freshness (default 30 min = 1800 sec)
# Edit prompt-stats.sh line: if [ $FILE_AGE -gt 1800 ]; then
```

### Disabling the Prompt

To temporarily disable, comment out in `~/.zshrc`:

```zsh
# source $HOME/.betrace-dev/betrace-prompt-theme.zsh
```

Or use a different theme:

```zsh
# Use oh-my-zsh theme instead
ZSH_THEME="agnoster"
# source $HOME/.betrace-dev/betrace-prompt-theme.zsh  # Disable BeTrace prompt
```

## Quick Start

### Run Tests Once
```bash
nix run .#test
```
This will:
1. Run frontend tests (Vitest) in parallel with backend tests (JUnit)
2. Generate coverage reports (Istanbul + JaCoCo)
3. Display a beautiful summary TUI
4. Validate coverage thresholds
5. Save results to `/tmp/betrace-test-results/`
6. Send desktop notification

### Watch Mode (TDD Workflow)
```bash
nix run .#test-watch
```
Automatically re-runs tests when source files change in `bff/src/` or `backend/src/`.

### Interactive Dashboard
```bash
nix run .#test-tui
```
Launches process-compose with:
- Test runner process
- HTML report server on http://localhost:12099
- Process management UI on http://localhost:12098

### View Coverage Reports
```bash
nix run .#test-coverage
```
Starts a local web server serving:
- **Frontend Coverage**: http://localhost:12099/frontend/coverage/lcov-report/
- **Backend Coverage**: http://localhost:12099/backend/coverage/
- **Summary Dashboard**: http://localhost:12099

### Validate Coverage Thresholds
```bash
nix run .#validate-coverage
```
Checks if coverage meets requirements:
- Instruction coverage ≥ 90%
- Branch coverage ≥ 80%

Exits with code 1 if thresholds not met.

## Test Result Artifacts

All test results are stored in `/tmp/betrace-test-results/`:

```
/tmp/betrace-test-results/
├── frontend/
│   ├── results.json        # Vitest test results
│   └── coverage/           # Istanbul coverage data
├── backend/
│   ├── surefire-reports/   # JUnit XML reports
│   └── coverage/           # JaCoCo HTML + XML
├── reports/
│   └── summary.json        # Aggregated test results
├── coverage/
│   └── summary.json        # Aggregated coverage data
├── history/
│   ├── 20250110_143022-results.json
│   ├── 20250110_143022-coverage.json
│   └── ...                 # Last 50 test runs
├── coverage-trend.json     # Coverage over time
├── test-runner.log         # Test runner logs
└── report-server.log       # Report server logs
```

## Coverage Thresholds

BeTrace enforces quality standards via coverage thresholds:

| Metric | Threshold | Requirement |
|--------|-----------|-------------|
| Overall Instruction Coverage | 90% | Mandatory |
| Overall Branch Coverage | 80% | Mandatory |
| Critical Components Instruction | 95% | Recommended |

### Configuring Thresholds

Set custom thresholds via environment variables:

```bash
export BETRACE_COVERAGE_INSTRUCTION_MIN=90
export BETRACE_COVERAGE_BRANCH_MIN=80
nix run .#test
```

## TUI Features

The test TUI displays:

### Header
```
╔════════════════════════════════════════════════════╗
║  🧪 BeTrace Test Runner                               ║
║  Real-time Testing & Coverage Monitoring           ║
╚════════════════════════════════════════════════════╝
```

### Test Results
```
✅ Frontend: 45/48 tests passed (93.75%)
❌ Backend:  42/46 tests passed (91.30%)
```

### Coverage Bars
```
📊 Code Coverage

Instruction: 87.2% ████████████████████████████████████████      (target: 90%)
Branch:      82.1% █████████████████████████████████████████     (target: 80%)
```

### Coverage Trend (Last 5 Runs)
```
📈 Coverage Trend (Last 10 Runs)

20250110_143022: Instruction 87%, Branch 82%
20250110_142515: Instruction 86%, Branch 81%
20250110_141203: Instruction 85%, Branch 80%
20250110_135844: Instruction 84%, Branch 79%
20250110_134521: Instruction 83%, Branch 78%
```

## Desktop Notifications

The test runner sends rich native desktop notifications with icons and sounds:

**On Success:**
```
✅ BeTrace Tests Passed
All 94 tests passed successfully!
Coverage: 89%

🔊 Sound: "Glass" (pleasant chime)
```

**On Failure:**
```
❌ BeTrace Tests Failed
4 of 94 tests failed
90 passed (96%)

🔊 Sound: "Sosumi" (alert sound)
```

**No Tests:**
```
⚠️ BeTrace Tests
No tests were executed

🔊 Sound: "Basso" (warning)
```

**Platform Support:**
- **macOS**: Uses `osascript` with emoji icons, custom sounds, and subtitles
- **Linux**: Uses `libnotify` with standard icons (dialog-information, dialog-error, dialog-warning)

## File Watching

Watch mode monitors these directories:
- `bff/src/**/*.{ts,tsx,js,jsx}` - Frontend source files
- `backend/src/**/*.java` - Backend source files

**Excluded patterns:**
- `**/node_modules/**`
- `**/target/**`
- `**/.git/**`
- `**/*.log`

**Debouncing:** 500ms delay to avoid rapid re-runs during bulk file operations.

## Process Orchestration

The test-tui mode uses `process-compose` to orchestrate:

1. **Test Runner Process**
   - Runs tests once
   - Saves results and coverage
   - Tracks history
   - Sends notifications
   - Exits after completion

2. **Report Server Process**
   - Serves HTML coverage reports
   - Auto-restarts on failure
   - Available at http://localhost:12099

3. **Process UI** (optional)
   - View logs for each process
   - Restart individual processes
   - Available at http://localhost:12098

## Coverage Report Formats

### Frontend (Vitest + Istanbul/c8)
- **HTML**: `bff/coverage/lcov-report/index.html`
- **JSON**: `bff/coverage/coverage-summary.json`
- **LCOV**: `bff/coverage/lcov.info`

### Backend (Maven + JaCoCo)
- **HTML**: `backend/target/site/jacoco/index.html`
- **XML**: `backend/target/site/jacoco/jacoco.xml`
- **CSV**: `backend/target/site/jacoco/jacoco.csv`

### Unified Reports
- **Summary JSON**: `/tmp/betrace-test-results/coverage/summary.json`
  ```json
  {
    "backend": {
      "instruction": 89.2,
      "branch": 84.1
    },
    "frontend": {
      "instruction": 91.5,
      "branch": 87.3
    },
    "overall": {
      "instruction": 90.35,
      "branch": 85.7
    }
  }
  ```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: cachix/install-nix-action@v20
      - name: Run tests with coverage
        run: nix run .#test
      - name: Validate coverage thresholds
        run: nix run .#validate-coverage
      - name: Upload coverage reports
        uses: actions/upload-artifact@v3
        with:
          name: coverage-reports
          path: /tmp/betrace-test-results/
```

## Troubleshooting

### Tests Not Running

**Problem:** `nix run .#test` does nothing

**Solution:**
1. Check that dependencies are installed: `nix develop`
2. Verify test files exist in `bff/src/` and `backend/src/test/`
3. Check logs: `cat /tmp/betrace-test-results/test-runner.log`

### Coverage Thresholds Failing

**Problem:** `validate-coverage` exits with code 1

**Solution:**
1. View detailed coverage: `nix run .#test-coverage`
2. Identify uncovered code in HTML reports
3. Add tests for critical paths
4. Temporarily lower thresholds (not recommended):
   ```bash
   export BETRACE_COVERAGE_INSTRUCTION_MIN=85
   export BETRACE_COVERAGE_BRANCH_MIN=75
   ```

### Watch Mode Not Detecting Changes

**Problem:** `test-watch` doesn't re-run tests on file changes

**Solution:**
1. Verify `fswatch` is installed: `which fswatch`
2. Check watch patterns match your files
3. Manually test fswatch: `fswatch -o bff/src`

### Desktop Notifications Not Working

**Problem:** No notifications appear

**Solution:**
- **macOS**: Grant Terminal.app notification permissions in System Preferences
- **Linux**: Install libnotify: `sudo apt install libnotify-bin`

### Report Server Port Conflict

**Problem:** "Address already in use" error on port 12099

**Solution:**
```bash
# Find and kill process using port 12099
lsof -ti:12099 | xargs kill -9

# Or use a different port
PORT=8080 nix run .#test-coverage
```

## Advanced Usage

### Running Individual Test Suites

```bash
# Frontend only
cd bff && npm run test

# Backend only
cd backend && mvn test

# Or use the individual runners
nix run .#frontend-test
nix run .#backend-test
```

### Parsing Coverage Programmatically

```bash
# Parse coverage data
nix run .#parse-coverage

# Parse test results
nix run .#parse-results

# Example output
cat /tmp/betrace-test-results/coverage/summary.json | jq '.overall.instruction'
# 90.35
```

### Custom TUI

```bash
# Simple TUI (no history)
nix run .#simple-tui

# Enhanced TUI (with history and trends)
nix run .#tui
```

### Manual History Tracking

```bash
# Track current results to history
nix run .#track-history

# View coverage trend
cat /tmp/betrace-test-results/coverage-trend.json | jq
```

## Architecture

The test runner is built with:

- **Nix**: Pure, reproducible build system
- **gum**: Beautiful TUI components
- **process-compose**: Service orchestration
- **fswatch**: File system monitoring
- **xmlstarlet**: XML parsing (JaCoCo reports)
- **jq**: JSON parsing (Vitest reports)
- **Caddy**: Static file server for reports
- **libnotify/osascript**: Desktop notifications

### Component Diagram

```
┌─────────────────────────────────────────────────┐
│               test-runner.nix                   │
│                                                 │
│  ┌─────────────┐      ┌──────────────┐        │
│  │  Frontend   │      │   Backend    │        │
│  │   Runner    │      │    Runner    │        │
│  │  (Vitest)   │      │   (Maven)    │        │
│  └──────┬──────┘      └──────┬───────┘        │
│         │                    │                 │
│         ▼                    ▼                 │
│  ┌────────────────────────────────┐           │
│  │     Results Parser             │           │
│  │  (Aggregates test data)        │           │
│  └────────────┬───────────────────┘           │
│               │                                │
│               ▼                                │
│  ┌────────────────────────────────┐           │
│  │    Coverage Parser             │           │
│  │  (Merges Istanbul + JaCoCo)    │           │
│  └────────────┬───────────────────┘           │
│               │                                │
│               ▼                                │
│  ┌────────────────────────────────┐           │
│  │      TUI Renderer (gum)        │           │
│  │  - Progress bars               │           │
│  │  - Coverage visualization      │           │
│  │  - Historical trends           │           │
│  └────────────┬───────────────────┘           │
│               │                                │
│               ▼                                │
│  ┌────────────────────────────────┐           │
│  │   History Tracker              │           │
│  │  - Save results                │           │
│  │  - Generate trends             │           │
│  └────────────┬───────────────────┘           │
│               │                                │
│               ▼                                │
│  ┌────────────────────────────────┐           │
│  │    Notification Service        │           │
│  │  - Desktop alerts              │           │
│  └────────────────────────────────┘           │
└─────────────────────────────────────────────────┘
```

## Contributing

When adding new tests:

1. **Frontend**: Place in `bff/src/**/*.test.ts` or `*.spec.ts`
2. **Backend**: Place in `backend/src/test/java/**/*Test.java`
3. Aim for 90%+ instruction coverage, 80%+ branch coverage
4. Run `nix run .#test-watch` during development
5. Verify coverage before committing: `nix run .#validate-coverage`

## References

- **ADR-015**: Development Workflow and Quality Standards
- **CLAUDE.md**: Project development guidelines
- **test-runner.nix**: Implementation source code
