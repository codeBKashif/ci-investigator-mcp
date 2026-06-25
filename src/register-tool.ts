import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

import { fetchFailedRuns } from './tools/failed-runs.js';
import { summarizeFailure } from './tools/summarize-failure.js';
import { compareWithLastSuccess } from './tools/compare-success.js';
import { detectFlakyTests } from './tools/flaky-test.js';
import { explainFailureRootCause } from './tools/explain-failure-root-cause.js';
import { suggestFixForFailure } from './tools/suggest-fix-for-failure.js';
import { listFailureTrends } from './tools/list-failure-trends.js';
import { findRegressionPrOrCommit } from './tools/find-regression-pr-or-commit.js';
import { calculateCiHealthScore } from './tools/ci-health-score.js';
import { buildFailureNotificationsDigest } from './tools/failure-notifications-digest.js';

export const registerTools = (server: McpServer) => {
  server.registerTool(
    'get_failed_runs',
    {
      description: 'List recent failed CI runs for a GitHub repo',
      inputSchema: {
        owner: z.string().min(1).describe('GitHub repo owner or org'),
        repo: z.string().min(1).describe('GitHub repo name'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .default(10)
          .describe('Max runs to return'),
      },
    },
    async ({ owner, repo, limit }) => {
      const runs = await fetchFailedRuns(owner, repo, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify(runs, null, 2) }],
      };
    },
  );

  server.registerTool(
    'summarize_failure',
    {
      description: 'Fetch and summarize the logs of a failed CI run',
      inputSchema: {
        owner: z.string().min(1).describe('GitHub repo owner or org'),
        repo: z.string().min(1).describe('GitHub repo name'),
        run_id: z.number().int().positive().describe('The failed run ID'),
      },
    },
    async ({ owner, repo, run_id }) => {
      const summary = await summarizeFailure(owner, repo, run_id);
      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
      };
    },
  );

  server.registerTool(
    'compare_with_last_success',
    {
      description: 'Compare a failed run with the last successful run on the same branch',
      inputSchema: {
        owner: z.string().min(1).describe('GitHub repo owner or org'),
        repo: z.string().min(1).describe('GitHub repo name'),
        run_id: z.number().int().positive().describe('The failed run ID'),
      },
    },
    async ({ owner, repo, run_id }) => {
      const comparison = await compareWithLastSuccess(owner, repo, run_id);
      return {
        content: [{ type: 'text', text: JSON.stringify(comparison, null, 2) }],
      };
    },
  );

  server.registerTool(
    'detect_flaky_tests',
    {
      description: 'Analyze run history to detect flaky jobs on a branch',
      inputSchema: {
        owner: z.string().min(1).describe('GitHub repo owner or org'),
        repo: z.string().min(1).describe('GitHub repo name'),
        branch: z.string().min(1).describe('Branch to analyze'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .default(30)
          .describe('Number of runs to analyze'),
      },
    },
    async ({ owner, repo, branch, limit }) => {
      const report = await detectFlakyTests(owner, repo, branch, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
      };
    },
  );

  server.registerTool(
    'explain_failure_root_cause',
    {
      description: 'Classify the likely root cause category for a failed CI run',
      inputSchema: {
        owner: z.string().min(1).describe('GitHub repo owner or org'),
        repo: z.string().min(1).describe('GitHub repo name'),
        run_id: z.number().int().positive().describe('The failed run ID'),
      },
    },
    async ({ owner, repo, run_id }) => {
      const analysis = await explainFailureRootCause(owner, repo, run_id);
      return {
        content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }],
      };
    },
  );

  server.registerTool(
    'suggest_fix_for_failure',
    {
      description: 'Suggest remediation steps and validation checks for a failed CI run',
      inputSchema: {
        owner: z.string().min(1).describe('GitHub repo owner or org'),
        repo: z.string().min(1).describe('GitHub repo name'),
        run_id: z.number().int().positive().describe('The failed run ID'),
      },
    },
    async ({ owner, repo, run_id }) => {
      const result = await suggestFixForFailure(owner, repo, run_id);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    'list_failure_trends',
    {
      description: 'Summarize recurring failed jobs over a time window',
      inputSchema: {
        owner: z.string().min(1).describe('GitHub repo owner or org'),
        repo: z.string().min(1).describe('GitHub repo name'),
        days: z.number().int().min(1).max(90).optional().default(14).describe('Window in days'),
        branch: z.string().min(1).optional().describe('Optional branch filter'),
        limit: z
          .number()
          .int()
          .min(10)
          .max(100)
          .optional()
          .default(100)
          .describe('Max failed runs to inspect'),
      },
    },
    async ({ owner, repo, days, branch, limit }) => {
      const trends = await listFailureTrends(owner, repo, days, branch, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify(trends, null, 2) }],
      };
    },
  );

  server.registerTool(
    'find_regression_pr_or_commit',
    {
      description: 'Find likely regression commit and related pull request for a failed run',
      inputSchema: {
        owner: z.string().min(1).describe('GitHub repo owner or org'),
        repo: z.string().min(1).describe('GitHub repo name'),
        run_id: z.number().int().positive().describe('The failed run ID'),
      },
    },
    async ({ owner, repo, run_id }) => {
      const suspect = await findRegressionPrOrCommit(owner, repo, run_id);
      return {
        content: [{ type: 'text', text: JSON.stringify(suspect, null, 2) }],
      };
    },
  );

  server.registerTool(
    'ci_health_score',
    {
      description: 'Compute a CI health score for a branch based on pass/fail and flakiness',
      inputSchema: {
        owner: z.string().min(1).describe('GitHub repo owner or org'),
        repo: z.string().min(1).describe('GitHub repo name'),
        branch: z.string().min(1).describe('Branch to analyze'),
        days: z.number().int().min(1).max(90).optional().default(14).describe('Window in days'),
        limit: z
          .number()
          .int()
          .min(10)
          .max(100)
          .optional()
          .default(100)
          .describe('Max completed runs to inspect'),
      },
    },
    async ({ owner, repo, branch, days, limit }) => {
      const score = await calculateCiHealthScore(owner, repo, branch, days, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify(score, null, 2) }],
      };
    },
  );

  server.registerTool(
    'failure_notifications_digest',
    {
      description: 'Build a deduplicated digest of recent failures for alerting and triage',
      inputSchema: {
        owner: z.string().min(1).describe('GitHub repo owner or org'),
        repo: z.string().min(1).describe('GitHub repo name'),
        interval_hours: z
          .number()
          .int()
          .min(1)
          .max(168)
          .optional()
          .default(24)
          .describe('Digest interval in hours'),
        branch: z.string().min(1).optional().describe('Optional branch filter'),
        limit: z
          .number()
          .int()
          .min(5)
          .max(50)
          .optional()
          .default(20)
          .describe('Max failures to summarize'),
      },
    },
    async ({ owner, repo, interval_hours, branch, limit }) => {
      const digest = await buildFailureNotificationsDigest(
        owner,
        repo,
        interval_hours,
        branch,
        limit,
      );
      return {
        content: [{ type: 'text', text: JSON.stringify(digest, null, 2) }],
      };
    },
  );
};
