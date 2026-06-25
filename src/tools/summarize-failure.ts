import { getClient } from '../github/get-client.js';
import { fetchRunLogs } from '../github/log.js';
import { FailureSummary, GitHubJob, GitHubStep } from '../types.js';

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function summarizeJobLogTail(jobLogs: string): string {
  const tail = jobLogs.split('\n').slice(-120).join('\n');
  return `Log download unavailable; using failed job logs tail:\n${tail}`;
}

function extractCheckRunId(checkRunUrl?: string): number | null {
  if (!checkRunUrl) {
    return null;
  }

  const match = checkRunUrl.match(/\/check-runs\/(\d+)/);
  if (!match) {
    return null;
  }

  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}

async function buildAnnotationFallback(
  owner: string,
  repo: string,
  failedJob: GitHubJob,
): Promise<string | null> {
  const checkRunId = extractCheckRunId(failedJob.check_run_url);
  if (!checkRunId) {
    return null;
  }

  try {
    const annotations = await getClient().getCheckRunAnnotations(owner, repo, checkRunId, 15);

    if (annotations.length === 0) {
      return 'No check-run annotations were returned.';
    }

    const lines = annotations.slice(0, 8).map((annotation, index) => {
      const location = `${annotation.path}:${annotation.start_line}`;
      const title = annotation.title ? `${annotation.title} - ` : '';
      return `${index + 1}. [${annotation.annotation_level}] ${location} ${title}${annotation.message}`;
    });

    return `Log download unavailable; using check-run annotations:\n${lines.join('\n')}`;
  } catch (error) {
    return `Unable to fetch check-run annotations: ${toErrorMessage(error)}`;
  }
}

export async function summarizeFailure(
  owner: string,
  repo: string,
  runId: number,
): Promise<FailureSummary> {
  const jobsData = await getClient().getJobs(owner, repo, runId);

  let runLogs = 'Log download unavailable.';
  try {
    runLogs = await fetchRunLogs(owner, repo, runId);
  } catch (error) {
    runLogs = `Unable to fetch logs: ${toErrorMessage(error)}`;
  }

  const failedJob = jobsData.jobs.find((j: GitHubJob) => j.conclusion === 'failure');
  if (!failedJob) {
    return {
      run_id: runId,
      failed_job: 'unknown',
      failed_step: 'unknown',
      log_excerpt: runLogs,
    };
  }

  const failedStep = failedJob.steps.find((s: GitHubStep) => s.conclusion === 'failure');

  if (runLogs.startsWith('Unable to fetch logs:')) {
    // Parallelize job logs and annotations fetching
    const [jobLogsResult, annotationResult] = await Promise.allSettled([
      getClient().getJobLogs(owner, repo, failedJob.id),
      buildAnnotationFallback(owner, repo, failedJob),
    ]);

    if (jobLogsResult.status === 'fulfilled') {
      runLogs = `${runLogs}\n${summarizeJobLogTail(jobLogsResult.value)}`;
    } else {
      runLogs = `${runLogs}\nUnable to fetch failed job logs: ${toErrorMessage(jobLogsResult.reason)}`;

      if (annotationResult.status === 'fulfilled' && annotationResult.value) {
        runLogs = `${runLogs}\n${annotationResult.value}`;
      }
    }
  }

  return {
    run_id: runId,
    failed_job: failedJob.name,
    failed_step: failedStep?.name ?? 'unknown',
    log_excerpt: runLogs,
  };
}
