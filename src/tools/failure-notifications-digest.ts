import { summarizeFailure } from './summarize-failure.js';
import { getClient } from '../github/get-client.js';
import { FailureDigest, FailureDigestItem, GitHubWorkflowRun } from '../types.js';

function isWithinHours(dateISO: string, intervalHours: number): boolean {
  const threshold = Date.now() - intervalHours * 60 * 60 * 1000;
  return new Date(dateISO).getTime() >= threshold;
}

function compactSummary(logExcerpt: string): string {
  const firstLine =
    logExcerpt.split('\n').find((line) => line.trim().length > 0) ?? 'No log excerpt';
  return firstLine.slice(0, 180);
}

export async function buildFailureNotificationsDigest(
  owner: string,
  repo: string,
  intervalHours: number = 24,
  branch?: string,
  limit: number = 20,
): Promise<FailureDigest> {
  const response = await getClient().getRuns(owner, repo, {
    status: 'failure',
    per_page: Math.max(limit, 20),
    branch,
  });

  const runs = response.workflow_runs
    .filter(
      (run: GitHubWorkflowRun) =>
        isWithinHours(run.created_at, intervalHours) && (!branch || run.head_branch === branch),
    )
    .slice(0, limit);

  const summaries = await Promise.allSettled(
    runs.map(async (run: GitHubWorkflowRun) => {
      const summary = await summarizeFailure(owner, repo, run.id);
      return { run, summary };
    }),
  );

  const grouped = new Map<string, FailureDigestItem>();

  for (const item of summaries) {
    if (item.status !== 'fulfilled') {
      continue;
    }

    const { run, summary } = item.value;
    const signature = `${summary.failed_job}::${summary.failed_step}`;
    const existing = grouped.get(signature) ?? {
      signature,
      occurrences: 0,
      latest_run_id: run.id,
      latest_seen: run.created_at,
      example_summary: compactSummary(summary.log_excerpt),
    };

    existing.occurrences += 1;
    if (run.created_at > existing.latest_seen) {
      existing.latest_seen = run.created_at;
      existing.latest_run_id = run.id;
      existing.example_summary = compactSummary(summary.log_excerpt);
    }

    grouped.set(signature, existing);
  }

  return {
    repo: `${owner}/${repo}`,
    branch: branch ?? null,
    interval_hours: intervalHours,
    total_failures: runs.length,
    grouped_failures: Array.from(grouped.values()).sort((a, b) => b.occurrences - a.occurrences),
  };
}
