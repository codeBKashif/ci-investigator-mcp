export interface GitHubWorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  html_url: string;
  status?: string;
  conclusion: string;
  event: string;
  created_at: string;
  updated_at: string;
  head_commit: {
    message: string;
    author: {
      name: string;
    };
  };
}

export interface GitHubWorkflowRunsResponse {
  workflow_runs: GitHubWorkflowRun[];
}

export interface GitHubJob {
  id: number;
  name: string;
  status: string;
  conclusion: string;
  check_run_url?: string;
  steps: GitHubStep[];
}

export interface GitHubStep {
  name: string;
  status: string;
  conclusion: string;
  number: number;
}

export interface GitHubJobsResponse {
  jobs: GitHubJob[];
}

export interface GitHubCheckRunAnnotation {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: string;
  title: string | null;
  message: string;
}

export interface FailedRun {
  id: number;
  name: string;
  branch: string;
  commit: string;
  url: string;
  created_at: string;
  updated_at: string;
}

export interface FailureSummary {
  run_id: number;
  failed_job: string;
  failed_step: string;
  log_excerpt: string;
}

export interface RunSnapshot {
  id: number;
  commit: string;
  commit_message: string;
  author: string;
  branch: string;
  created_at: string;
  event: string;
}

export interface RunDiff {
  commit_changed: boolean;
  author_changed: boolean;
  event_changed: boolean;
  commits_between: string;
}

export interface RunComparison {
  failed_run: RunSnapshot;
  last_success: RunSnapshot | null;
  diff: RunDiff;
}

export interface FlakyTest {
  job_name: string;
  pass_count: number;
  fail_count: number;
  flakiness_score: number;
  last_seen: string;
}

export interface FlakyTestsReport {
  repo: string;
  branch: string;
  total_runs_analyzed: number;
  flaky_jobs: FlakyTest[];
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface RunOptions {
  status?: string;
  branch?: string;
  per_page?: number;
}

export interface RootCauseAnalysis {
  run_id: number;
  category:
    | 'test_regression'
    | 'infra_network'
    | 'dependency'
    | 'timeout'
    | 'lint_or_type'
    | 'auth_permissions'
    | 'unknown';
  confidence: number;
  evidence: string[];
  failed_job: string;
  failed_step: string;
}

export interface SuggestedFix {
  run_id: number;
  category: RootCauseAnalysis['category'];
  suggestions: string[];
  validation_steps: string[];
}

export interface FailureTrendItem {
  job_name: string;
  failures: number;
  first_seen: string;
  last_seen: string;
}

export interface FailureTrends {
  repo: string;
  branch: string | null;
  window_days: number;
  total_failures: number;
  top_failing_jobs: FailureTrendItem[];
}

export interface RegressionSuspect {
  run_id: number;
  branch: string;
  compare_url: string;
  suspect_commit_sha: string;
  suspect_pr: {
    number: number;
    title: string;
    url: string;
    state: string;
  } | null;
}

export interface RerunTrackingResult {
  run_id: number;
  rerun_mode: 'failed_jobs' | 'all_jobs';
  accepted: boolean;
  latest_status: string;
  latest_conclusion: string | null;
  poll_attempts: number;
}

export interface CIHealthScore {
  repo: string;
  branch: string;
  window_days: number;
  total_runs: number;
  pass_rate: number;
  failure_rate: number;
  flaky_jobs: number;
  score: number;
}

export interface FailureDigestItem {
  signature: string;
  occurrences: number;
  latest_run_id: number;
  latest_seen: string;
  example_summary: string;
}

export interface FailureDigest {
  repo: string;
  branch: string | null;
  interval_hours: number;
  total_failures: number;
  grouped_failures: FailureDigestItem[];
}
