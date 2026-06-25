import { getClient } from '../github/get-client.js';
import { FailureTrendItem, FailureTrends, GitHubJob, GitHubWorkflowRun } from '../types.js';

function isWithinWindow(dateISO: string, days: number): boolean {
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(dateISO).getTime() >= threshold;
}

export async function listFailureTrends(
  owner: string,
  repo: string,
  days: number = 14,
  branch?: string,
  limit: number = 100,
): Promise<FailureTrends> {
  const response = await getClient().getRuns(owner, repo, {
    status: 'failure',
    per_page: limit,
    branch,
  });

  const filteredRuns = response.workflow_runs.filter(
    (run: GitHubWorkflowRun) =>
      isWithinWindow(run.created_at, days) && (!branch || run.head_branch === branch),
  );

  const jobsByRun = await Promise.allSettled(
    filteredRuns.map(async (run: GitHubWorkflowRun) => {
      const jobs = await getClient().getJobs(owner, repo, run.id);
      return { run, jobs: jobs.jobs };
    }),
  );

  const trends = new Map<string, FailureTrendItem>();

  for (const result of jobsByRun) {
    if (result.status !== 'fulfilled') {
      continue;
    }

    const { run, jobs } = result.value;
    const failedJobs = jobs.filter((job: GitHubJob) => job.conclusion === 'failure');

    if (failedJobs.length === 0) {
      const key = run.name || 'workflow_failure';
      const item = trends.get(key) ?? {
        job_name: key,
        failures: 0,
        first_seen: run.created_at,
        last_seen: run.created_at,
      };
      item.failures += 1;
      if (run.created_at < item.first_seen) item.first_seen = run.created_at;
      if (run.created_at > item.last_seen) item.last_seen = run.created_at;
      trends.set(key, item);
      continue;
    }

    for (const job of failedJobs) {
      const item = trends.get(job.name) ?? {
        job_name: job.name,
        failures: 0,
        first_seen: run.created_at,
        last_seen: run.created_at,
      };

      item.failures += 1;
      if (run.created_at < item.first_seen) item.first_seen = run.created_at;
      if (run.created_at > item.last_seen) item.last_seen = run.created_at;

      trends.set(job.name, item);
    }
  }

  const topFailingJobs = Array.from(trends.values())
    .sort((a, b) => b.failures - a.failures)
    .slice(0, 10);

  return {
    repo: `${owner}/${repo}`,
    branch: branch ?? null,
    window_days: days,
    total_failures: filteredRuns.length,
    top_failing_jobs: topFailingJobs,
  };
}
