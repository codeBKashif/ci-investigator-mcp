import { getClient } from '../github/get-client.js';
import { GitHubWorkflowRun, RunComparison, RunSnapshot } from '../types.js';

function toSnapshot(run: GitHubWorkflowRun): RunSnapshot {
  return {
    id: run.id,
    commit: run.head_sha.slice(0, 7),
    commit_message: run.head_commit?.message?.split('\n')[0] ?? 'unknown',
    author: run.head_commit?.author?.name ?? 'unknown',
    branch: run.head_branch,
    created_at: run.created_at,
    event: run.event,
  };
}

export async function compareWithLastSuccess(
  owner: string,
  repo: string,
  runId: number,
): Promise<RunComparison> {
  const response = await getClient().getRuns(owner, repo, {
    per_page: 100,
    status: 'completed',
  });
  const runs = response.workflow_runs;

  const failedRun = runs.find((r: GitHubWorkflowRun) => r.id === runId);
  if (!failedRun) throw new Error(`Run ${runId} not found`);

  // Filter by branch first to reduce search space
  const branchRuns = runs.filter((r: GitHubWorkflowRun) => r.head_branch === failedRun.head_branch);

  // Find the most recent successful run before this failed run
  const lastSuccess =
    branchRuns
      .filter(
        (r: GitHubWorkflowRun) => r.conclusion === 'success' && r.created_at < failedRun.created_at,
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ??
    null;

  const failedSnapshot = toSnapshot(failedRun);
  const successSnapshot = lastSuccess ? toSnapshot(lastSuccess) : null;
  const hasBaseline = Boolean(lastSuccess);

  return {
    failed_run: failedSnapshot,
    last_success: successSnapshot,
    diff: {
      commit_changed: hasBaseline ? lastSuccess!.head_sha !== failedRun.head_sha : false,
      author_changed: hasBaseline ? successSnapshot!.author !== failedSnapshot.author : false,
      event_changed: hasBaseline ? successSnapshot!.event !== failedSnapshot.event : false,
      commits_between: hasBaseline
        ? `https://github.com/${owner}/${repo}/compare/${lastSuccess!.head_sha}...${failedRun.head_sha}`
        : 'no previous success found on this branch',
    },
  };
}
