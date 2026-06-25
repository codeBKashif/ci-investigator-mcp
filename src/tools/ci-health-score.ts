import { getClient } from '../github/get-client.js';
import { CIHealthScore, GitHubJob, GitHubWorkflowRun } from '../types.js';

function isWithinWindow(dateISO: string, days: number): boolean {
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(dateISO).getTime() >= threshold;
}

function clampScore(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

export async function calculateCiHealthScore(
  owner: string,
  repo: string,
  branch: string,
  days: number = 14,
  limit: number = 100,
): Promise<CIHealthScore> {
  const response = await getClient().getRuns(owner, repo, {
    status: 'completed',
    per_page: limit,
    branch,
  });

  const runs = response.workflow_runs.filter(
    (run: GitHubWorkflowRun) => run.head_branch === branch && isWithinWindow(run.created_at, days),
  );

  const successCount = runs.filter((run: GitHubWorkflowRun) => run.conclusion === 'success').length;
  const failureCount = runs.filter((run: GitHubWorkflowRun) => run.conclusion === 'failure').length;
  const totalRuns = runs.length;

  const passRate = totalRuns === 0 ? 0 : successCount / totalRuns;
  const failureRate = totalRuns === 0 ? 0 : failureCount / totalRuns;

  const jobsByRun = await Promise.allSettled(
    runs.map(async (run: GitHubWorkflowRun) => {
      const jobs = await getClient().getJobs(owner, repo, run.id);
      return jobs.jobs;
    }),
  );

  const jobStats = new Map<string, { pass: number; fail: number }>();
  for (const result of jobsByRun) {
    if (result.status !== 'fulfilled') {
      continue;
    }

    for (const job of result.value as GitHubJob[]) {
      const stats = jobStats.get(job.name) ?? { pass: 0, fail: 0 };
      if (job.conclusion === 'success') stats.pass += 1;
      if (job.conclusion === 'failure') stats.fail += 1;
      jobStats.set(job.name, stats);
    }
  }

  const flakyJobs = Array.from(jobStats.values()).filter(
    (job) => job.pass > 0 && job.fail > 0,
  ).length;

  const score = clampScore(passRate * 100 - flakyJobs * 2);

  return {
    repo: `${owner}/${repo}`,
    branch,
    window_days: days,
    total_runs: totalRuns,
    pass_rate: parseFloat(passRate.toFixed(2)),
    failure_rate: parseFloat(failureRate.toFixed(2)),
    flaky_jobs: flakyJobs,
    score: parseFloat(score.toFixed(2)),
  };
}
