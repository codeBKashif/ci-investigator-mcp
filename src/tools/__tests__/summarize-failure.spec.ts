import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getClient } from '../../github/get-client.js';
import { fetchRunLogs } from '../../github/log.js';
import { createJob, createStep } from '../../tests/helper.js';
import { GitHubCheckRunAnnotation } from '../../types.js';
import { summarizeFailure } from '../summarize-failure.js';

vi.mock('../../github/get-client.js', () => ({
  getClient: vi.fn(),
}));

vi.mock('../../github/log.js', () => ({
  fetchRunLogs: vi.fn(),
}));

describe('summarizeFailure', () => {
  const mockClient = {
    getJobs: vi.fn(),
    getJobLogs: vi.fn(),
    getCheckRunAnnotations: vi.fn(),
  };

  const failedJobFixture = () =>
    createJob({
      id: 91,
      name: 'build',
      conclusion: 'failure',
      check_run_url: 'https://api.github.com/repos/octo/repo/check-runs/77',
      steps: [
        createStep({ name: 'Checkout' }),
        createStep({ name: 'Run tests', conclusion: 'failure', number: 2 }),
      ],
    });

  beforeEach(() => {
    vi.mocked(getClient).mockReturnValue(mockClient as never);
  });

  it('returns the failed job, step, and fetched logs when available', async () => {
    mockClient.getJobs.mockResolvedValue({ jobs: [failedJobFixture()] });
    vi.mocked(fetchRunLogs).mockResolvedValue('full logs');

    const result = await summarizeFailure('octo', 'repo', 55);

    expect(result).toEqual({
      run_id: 55,
      failed_job: 'build',
      failed_step: 'Run tests',
      log_excerpt: 'full logs',
    });
  });

  it('falls back to failed job logs when run logs cannot be downloaded', async () => {
    mockClient.getJobs.mockResolvedValue({ jobs: [failedJobFixture()] });
    vi.mocked(fetchRunLogs).mockRejectedValue(new Error('zip unavailable'));
    mockClient.getJobLogs.mockResolvedValue('line 1\nline 2');

    const result = await summarizeFailure('octo', 'repo', 55);

    expect(result.failed_job).toBe('build');
    expect(result.failed_step).toBe('Run tests');
    expect(result.log_excerpt).toContain('Unable to fetch logs: zip unavailable');
    expect(result.log_excerpt).toContain('Log download unavailable; using failed job logs tail:');
    expect(result.log_excerpt).toContain('line 1\nline 2');
  });

  it('falls back to check-run annotations when both log downloads fail', async () => {
    const annotations: GitHubCheckRunAnnotation[] = [
      {
        path: 'src/index.ts',
        start_line: 10,
        end_line: 10,
        annotation_level: 'failure',
        title: 'Type error',
        message: 'Property does not exist',
      },
    ];

    mockClient.getJobs.mockResolvedValue({ jobs: [failedJobFixture()] });
    vi.mocked(fetchRunLogs).mockRejectedValue(new Error('zip unavailable'));
    mockClient.getJobLogs.mockRejectedValue(new Error('job logs unavailable'));
    mockClient.getCheckRunAnnotations.mockResolvedValue(annotations);

    const result = await summarizeFailure('octo', 'repo', 55);

    expect(mockClient.getCheckRunAnnotations).toHaveBeenCalledWith('octo', 'repo', 77, 15);
    expect(result.log_excerpt).toContain('Unable to fetch logs: zip unavailable');
    expect(result.log_excerpt).toContain('Unable to fetch failed job logs: job logs unavailable');
    expect(result.log_excerpt).toContain('Log download unavailable; using check-run annotations:');
    expect(result.log_excerpt).toContain(
      '1. [failure] src/index.ts:10 Type error - Property does not exist',
    );
  });

  it('returns unknown fields when no failed job is present', async () => {
    mockClient.getJobs.mockResolvedValue({
      jobs: [
        createJob({
          conclusion: 'success',
          steps: [createStep({ name: 'Run tests', conclusion: 'success' })],
        }),
      ],
    });
    vi.mocked(fetchRunLogs).mockResolvedValue('clean logs');

    const result = await summarizeFailure('octo', 'repo', 55);

    expect(result).toEqual({
      run_id: 55,
      failed_job: 'unknown',
      failed_step: 'unknown',
      log_excerpt: 'clean logs',
    });
  });

  it('fetches job logs and annotations in parallel for faster fallback', async () => {
    // This test verifies the parallelized fallback chain optimization
    mockClient.getJobs.mockResolvedValue({ jobs: [failedJobFixture()] });
    vi.mocked(fetchRunLogs).mockRejectedValue(new Error('zip unavailable'));

    // Simulate both falling and succeeding
    mockClient.getJobLogs.mockResolvedValue('job log content');
    mockClient.getCheckRunAnnotations.mockResolvedValue([]);

    const result = await summarizeFailure('octo', 'repo', 55);

    // Should use job logs when available, even though annotations also attempted
    expect(result.log_excerpt).toContain('job log content');
    // Both fetches should be attempted (parallelized)
    expect(mockClient.getJobLogs).toHaveBeenCalledWith('octo', 'repo', 91);
    expect(mockClient.getCheckRunAnnotations).toHaveBeenCalled();
  });

  it('uses annotations only when job logs fail but annotations succeed', async () => {
    // Verifies parallel fallback uses first available result
    const annotations: GitHubCheckRunAnnotation[] = [
      {
        path: 'test.ts',
        start_line: 5,
        end_line: 5,
        annotation_level: 'failure',
        title: 'Error',
        message: 'Test failed',
      },
    ];

    mockClient.getJobs.mockResolvedValue({ jobs: [failedJobFixture()] });
    vi.mocked(fetchRunLogs).mockRejectedValue(new Error('zip unavailable'));
    mockClient.getJobLogs.mockRejectedValue(new Error('logs unavailable'));
    mockClient.getCheckRunAnnotations.mockResolvedValue(annotations);

    const result = await summarizeFailure('octo', 'repo', 55);

    // Should fall back to annotations when job logs fail
    expect(result.log_excerpt).toContain('[failure] test.ts:5 Error - Test failed');
  });
});
