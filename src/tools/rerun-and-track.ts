import { getClient } from '../github/get-client.js';
import { RerunTrackingResult } from '../types.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function rerunAndTrack(
  owner: string,
  repo: string,
  runId: number,
  mode: 'failed_jobs' | 'all_jobs' = 'failed_jobs',
  waitForCompletion: boolean = true,
  pollAttempts: number = 5,
  pollIntervalSeconds: number = 3,
): Promise<RerunTrackingResult> {
  if (mode === 'failed_jobs') {
    await getClient().rerunFailedJobs(owner, repo, runId);
  } else {
    await getClient().rerunRun(owner, repo, runId);
  }

  let latestStatus = 'queued';
  let latestConclusion: string | null = null;
  let attemptsUsed = 0;

  const attempts = Math.max(1, pollAttempts);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    attemptsUsed = attempt;
    const run = await getClient().getRun(owner, repo, runId);
    latestStatus = run.status ?? latestStatus;
    latestConclusion = run.conclusion ?? null;

    if (!waitForCompletion) {
      break;
    }

    if (latestStatus === 'completed') {
      break;
    }

    if (attempt < attempts) {
      await sleep(Math.max(1, pollIntervalSeconds) * 1000);
    }
  }

  return {
    run_id: runId,
    rerun_mode: mode,
    accepted: true,
    latest_status: latestStatus,
    latest_conclusion: latestConclusion,
    poll_attempts: attemptsUsed,
  };
}
