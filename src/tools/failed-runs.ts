import { getClient } from "../github/get-client.js";
import { FailedRun, GitHubWorkflowRun } from "../types.js";

export async function fetchFailedRuns(
  owner: string,
  repo: string,
  limit: number = 10,
): Promise<FailedRun[]> {
  const response = await getClient().getRuns(owner, repo, {
    status: "failure",
    per_page: limit,
  });

  return response.workflow_runs.map((run: GitHubWorkflowRun) => ({
    id: run.id,
    name: run.name,
    branch: run.head_branch,
    commit: run.head_sha.slice(0, 7),
    url: run.html_url,
    created_at: run.created_at,
    updated_at: run.updated_at,
  }));
}
