# CI Investigator MCP

Published MCP server for investigating GitHub Actions CI failures.

This package exposes tools to:

- list recent failed workflow runs
- summarize a failed run from logs
- compare a failed run with the previous success
- detect flaky jobs on a branch
- explain likely root cause category
- suggest remediation and validation steps
- report failure trends and CI health
- identify likely regression commit/PR
- generate failure digest for notifications

## Available Tools

### 1) get_failed_runs

List recent failed workflow runs for a repository.

Input:

- `owner` (string, required): repo owner or org
- `repo` (string, required): repo name
- `limit` (number, optional, default: 10, min: 1, max: 100)

Returns:

- array of failed runs with id, workflow name, branch, short commit, URL, and timestamps

### 2) summarize_failure

Fetch and summarize a failed run.

Input:

- `owner` (string, required)
- `repo` (string, required)
- `run_id` (number, required): failed workflow run id

Returns:

- run id
- failed job name
- failed step name
- log excerpt text

Notes:

- attempts run log download first
- falls back to failed job logs
- falls back to check-run annotations when logs are unavailable

### 3) compare_with_last_success

Compare a failed run with the previous successful run on the same branch.

Input:

- `owner` (string, required)
- `repo` (string, required)
- `run_id` (number, required): failed workflow run id

Returns:

- failed run snapshot
- last successful run snapshot (or `null`)
- diff fields:
  - `commit_changed`
  - `author_changed`
  - `event_changed`
  - `commits_between` (GitHub compare URL or fallback text)

### 4) detect_flaky_tests

Detect flaky jobs by analyzing recent completed runs on a branch.

Input:

- `owner` (string, required)
- `repo` (string, required)
- `branch` (string, required)
- `limit` (number, optional, default: 30, min: 1, max: 100)

Returns:

- repository and branch metadata
- number of analyzed runs
- flaky jobs with pass/fail counts and flakiness score

### 5) explain_failure_root_cause

Classify likely failure cause based on logs and fallback data.

Input:

- `owner` (string, required)
- `repo` (string, required)
- `run_id` (number, required)

Returns:

- cause category (`test_regression`, `infra_network`, `dependency`, `timeout`, `lint_or_type`, `auth_permissions`, `unknown`)
- confidence and supporting evidence lines
- failed job and failed step

### 6) suggest_fix_for_failure

Suggest practical remediation and validation steps for a failed run.

Input:

- `owner` (string, required)
- `repo` (string, required)
- `run_id` (number, required)

Returns:

- classified category
- targeted suggestions
- validation checklist

### 7) list_failure_trends

Summarize recurring failed jobs over a configurable time window.

Input:

- `owner` (string, required)
- `repo` (string, required)
- `days` (number, optional, default: 14)
- `branch` (string, optional)
- `limit` (number, optional, default: 100)

Returns:

- failure totals in the selected window
- top failing jobs with occurrence counts and first/last seen timestamps

### 8) find_regression_pr_or_commit

Find likely regression commit and linked PR for a failed run.

Input:

- `owner` (string, required)
- `repo` (string, required)
- `run_id` (number, required)

Returns:

- suspect commit SHA
- compare URL from last success to failed commit
- suspected PR metadata (if available)

### 9) ci_health_score

Compute CI health score for a branch using pass/fail and flaky-job signals.

Input:

- `owner` (string, required)
- `repo` (string, required)
- `branch` (string, required)
- `days` (number, optional, default: 14)
- `limit` (number, optional, default: 100)

Returns:

- pass/failure rates
- flaky jobs count
- overall health score (0-100)

### 10) failure_notifications_digest

Build deduplicated digest of recent failures for alerting/triage workflows.

Input:

- `owner` (string, required)
- `repo` (string, required)
- `interval_hours` (number, optional, default: 24)
- `branch` (string, optional)
- `limit` (number, optional, default: 20)

Returns:

- grouped failure signatures
- occurrence counts
- latest run references and compact example summary

## Requirements

- Node.js 20+
- GitHub token in environment

Recommended token permissions:

- `actions:read`
- `checks:read`
- `contents:read`

## Using an MCP Client

Running a server on its own is less useful than wiring it into an MCP client.

Set `GITHUB_TOKEN` in your client config:

```json
{
  "servers": {
    "ci-investigator": {
      "command": "npx",
      "args": ["-y", "ci-investigator-mcp"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token"
      }
    }
  }
}
```

On Windows, wrap `npx` with `cmd /c`:

```json
{
  "servers": {
    "ci-investigator": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "ci-investigator-mcp"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token"
      }
    }
  }
}
```

## Troubleshooting

- `401` or `403` errors: verify `GITHUB_TOKEN` and permissions.
- Empty or partial logs: some workflows/log artifacts can be unavailable; the server uses fallback strategies.
- Run not found: confirm `run_id`, `owner`, and `repo` are correct.
- IDE can't find `node` or `npx`

Some IDEs (VS Code, Cursor) launch with a limited PATH and can't find Node.js installed via nvm or similar version managers.

Run the following to find the full paths:

​`bash
which node && which npx
​`

Then use the full path in your MCP config:

​`jsonc
{
  "servers": {
    "ci-investigator": {
      "command": "/Users/your-user/.nvm/versions/node/v22.14.0/bin/npx",
      "args": ["-y", "ci-investigator-mcp"],
      "env": {
        "GITHUB_TOKEN": "your_token",
        "PATH": "/Users/your-user/.nvm/versions/node/v22.14.0/bin:/usr/local/bin:/usr/bin:/bin"
      }
    }
  }
}
​`

## License

ISC
