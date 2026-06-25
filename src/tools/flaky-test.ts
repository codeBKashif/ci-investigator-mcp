import { getClient } from '../github/get-client.js';
import { GitHubJob, GitHubWorkflowRun, FlakyTestsReport, FlakyTest } from '../types.js';

export async function detectFlakyTests(
  owner: string,
  repo: string,
  branch: string,
  limit: number = 30,
): Promise<FlakyTestsReport> {
  const response = await getClient().getRuns(owner, repo, {
    per_page: limit,
    status: 'completed',
  });

  const runs = response.workflow_runs.filter((r: GitHubWorkflowRun) => r.head_branch === branch);

  // fetch jobs for all runs in parallel
  const jobsPerRun = await Promise.allSettled(
    runs.map(async (r: GitHubWorkflowRun) => {
      const jobsResponse = await getClient().getJobs(owner, repo, r.id);
      return { run: r, jobs: jobsResponse.jobs };
    }),
  );

  // aggregate pass/fail counts per job name
  const jobStats = new Map<string, { pass: number; fail: number; last_seen: string }>();

  for (const result of jobsPerRun) {
    if (result.status !== 'fulfilled') {
      continue;
    }

    const { run, jobs } = result.value;
    for (const job of jobs as GitHubJob[]) {
      const existing = jobStats.get(job.name) ?? {
        pass: 0,
        fail: 0,
        last_seen: run.created_at,
      };

      if (job.conclusion === 'success') existing.pass += 1;
      if (job.conclusion === 'failure') existing.fail += 1;
      if (run.created_at > existing.last_seen) existing.last_seen = run.created_at;

      jobStats.set(job.name, existing);
    }
  }

  // flaky = job that both passed and failed across runs
  const flakyJobs: FlakyTest[] = [];

  for (const [job_name, stats] of jobStats.entries()) {
    const total = stats.pass + stats.fail;
    if (stats.pass > 0 && stats.fail > 0) {
      flakyJobs.push({
        job_name,
        pass_count: stats.pass,
        fail_count: stats.fail,
        flakiness_score: parseFloat((stats.fail / total).toFixed(2)),
        last_seen: stats.last_seen,
      });
    }
  }

  // sort by most flaky first
  flakyJobs.sort((a, b) => b.flakiness_score - a.flakiness_score);

  return {
    repo: `${owner}/${repo}`,
    branch,
    total_runs_analyzed: runs.length,
    flaky_jobs: flakyJobs,
  };
}
