import { GitHubJob, GitHubStep, GitHubWorkflowRun } from '../types.js';

export function createRun(overrides: Partial<GitHubWorkflowRun> = {}): GitHubWorkflowRun {
  return {
    id: 101,
    name: 'CI',
    head_branch: 'main',
    head_sha: 'abcdef1234567890',
    html_url: 'https://github.com/octo/repo/actions/runs/101',
    conclusion: 'failure',
    event: 'push',
    created_at: '2026-06-24T10:00:00Z',
    updated_at: '2026-06-24T10:05:00Z',
    head_commit: {
      message: 'Fix test',
      author: {
        name: 'Kashif',
      },
    },
    ...overrides,
  };
}

export function createStep(overrides: Partial<GitHubStep> = {}): GitHubStep {
  return {
    name: 'Install dependencies',
    status: 'completed',
    conclusion: 'success',
    number: 1,
    ...overrides,
  };
}

export function createJob(overrides: Partial<GitHubJob> = {}): GitHubJob {
  return {
    id: 1,
    name: 'unit',
    status: 'completed',
    conclusion: 'success',
    check_run_url: 'https://api.github.com/repos/octo/repo/check-runs/77',
    steps: [
      createStep({ name: 'Checkout' }),
      createStep({ name: 'Run tests', conclusion: 'failure', number: 2 }),
    ],
    ...overrides,
  };
}
