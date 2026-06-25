import { getClient } from '../github/get-client.js';
import { RegressionSuspect, GitHubWorkflowRun } from '../types.js';

export async function findRegressionPrOrCommit(
  owner: string,
  repo: string,
  runId: number,
): Promise<RegressionSuspect> {
  const response = await getClient().getRuns(owner, repo, {
    status: 'completed',
    per_page: 100,
  });

  const runs = response.workflow_runs;
  const failedRun = runs.find((run: GitHubWorkflowRun) => run.id === runId);

  if (!failedRun) {
    throw new Error(`Run ${runId} not found`);
  }

  const lastSuccess = runs
    .filter(
      (run: GitHubWorkflowRun) =>
        run.head_branch === failedRun.head_branch &&
        run.conclusion === 'success' &&
        run.created_at < failedRun.created_at,
    )
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const compareUrl = lastSuccess
    ? `https://github.com/${owner}/${repo}/compare/${lastSuccess.head_sha}...${failedRun.head_sha}`
    : `https://github.com/${owner}/${repo}/commit/${failedRun.head_sha}`;

  const pullRequests = await getClient().getCommitPullRequests(owner, repo, failedRun.head_sha);
  const selectedPr =
    pullRequests.find((pr: { merged_at?: string | null }) => Boolean(pr.merged_at)) ??
    pullRequests[0] ??
    null;

  return {
    run_id: runId,
    branch: failedRun.head_branch,
    compare_url: compareUrl,
    suspect_commit_sha: failedRun.head_sha,
    suspect_pr: selectedPr
      ? {
          number: selectedPr.number,
          title: selectedPr.title,
          url: selectedPr.html_url,
          state: selectedPr.state,
        }
      : null,
  };
}
