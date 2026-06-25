import AdmZip from 'adm-zip';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getClient } from '../get-client.js';
import { fetchRunLogs } from '../log.js';

vi.mock('../get-client.js', () => ({
  getClient: vi.fn(),
}));

vi.mock('adm-zip', () => ({
  default: vi.fn(),
}));

function mockZipEntries(entries: Array<{ entryName: string; getData: () => Buffer }>): void {
  vi.mocked(AdmZip).mockImplementation(function MockAdmZip() {
    return {
      getEntries: () => entries,
    } as never;
  } as never);
}

describe('fetchRunLogs', () => {
  const getRunLogs = vi.fn();

  beforeEach(() => {
    vi.mocked(getClient).mockReturnValue({
      getRunLogs,
    } as never);
  });

  it('requests logs for the selected run', async () => {
    getRunLogs.mockResolvedValue(Uint8Array.from([1, 2, 3]).buffer);
    mockZipEntries([
      {
        entryName: 'build.txt',
        getData: () => Buffer.from('line 1\nline 2'),
      },
    ]);

    await fetchRunLogs('octo', 'repo', 42);

    expect(getRunLogs).toHaveBeenCalledWith('octo', 'repo', 42);
  });

  it('returns combined content from text entries', async () => {
    getRunLogs.mockResolvedValue(Uint8Array.from([1, 2, 3]).buffer);
    mockZipEntries([
      {
        entryName: 'job-1.txt',
        getData: () => Buffer.from('alpha\nbeta'),
      },
      {
        entryName: 'job-2.txt',
        getData: () => Buffer.from('gamma\ndelta'),
      },
    ]);

    const result = await fetchRunLogs('octo', 'repo', 42);

    expect(result).toContain('--- job-1.txt ---');
    expect(result).toContain('alpha\nbeta');
    expect(result).toContain('--- job-2.txt ---');
    expect(result).toContain('gamma\ndelta');
  });

  it('ignores non-text entries', async () => {
    getRunLogs.mockResolvedValue(Uint8Array.from([1, 2, 3]).buffer);
    mockZipEntries([
      {
        entryName: 'job.txt',
        getData: () => Buffer.from('wanted output'),
      },
      {
        entryName: 'artifact.json',
        getData: () => Buffer.from('ignored output'),
      },
    ]);

    const result = await fetchRunLogs('octo', 'repo', 42);

    expect(result).toContain('wanted output');
    expect(result).not.toContain('ignored output');
  });

  it('limits output to the first six text files', async () => {
    getRunLogs.mockResolvedValue(Uint8Array.from([1, 2, 3]).buffer);
    const entries = Array.from({ length: 8 }, (_, index) => ({
      entryName: `job-${index + 1}.txt`,
      getData: () => Buffer.from(`content-${index + 1}`),
    }));

    mockZipEntries(entries);

    const result = await fetchRunLogs('octo', 'repo', 42);

    expect(result).toContain('content-1');
    expect(result).toContain('content-6');
    expect(result).not.toContain('content-7');
    expect(result).not.toContain('content-8');
  });

  it('keeps only the last 120 lines for each text file', async () => {
    getRunLogs.mockResolvedValue(Uint8Array.from([1, 2, 3]).buffer);
    const longLog = Array.from({ length: 130 }, (_, index) => `line-${index + 1}`).join('\n');

    mockZipEntries([
      {
        entryName: 'job.txt',
        getData: () => Buffer.from(longLog),
      },
    ]);

    const result = await fetchRunLogs('octo', 'repo', 42);

    const resultLines = result.split('\n');

    expect(resultLines).not.toContain('line-1');
    expect(resultLines).not.toContain('line-10');
    expect(resultLines).toContain('line-11');
    expect(resultLines).toContain('line-130');
  });

  it('throws when the log archive is empty', async () => {
    getRunLogs.mockResolvedValue(Uint8Array.from([1, 2, 3]).buffer);
    mockZipEntries([]);

    await expect(fetchRunLogs('octo', 'repo', 42)).rejects.toThrow(
      'No log files found in the downloaded zip.',
    );
  });
});
