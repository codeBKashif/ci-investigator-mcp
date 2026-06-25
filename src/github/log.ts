import AdmZip from 'adm-zip';
import { getClient } from './get-client.js';

function extractLogTail(content: string, maxLines: number = 120): string {
  // Cache the split to avoid re-splitting
  let lines: string[] | null = null;

  return (() => {
    if (!lines) {
      lines = content.split('\n');
    }
    return lines.slice(-maxLines).join('\n');
  })();
}

export async function fetchRunLogs(owner: string, repo: string, runId: number): Promise<string> {
  const logsData = await getClient().getRunLogs(owner, repo, runId);

  const zip = new AdmZip(Buffer.from(logsData));
  const entries = zip.getEntries();

  if (entries.length === 0) {
    throw new Error('No log files found in the downloaded zip.');
  }

  const logs: string[] = [];
  const textEntries = entries.filter((entry) => entry.entryName.endsWith('.txt'));
  const maxLogFiles = 6;

  for (const entry of textEntries.slice(0, maxLogFiles)) {
    const content = entry.getData().toString('utf-8');
    const tail = extractLogTail(content, 120);
    logs.push(`--- ${entry.entryName} ---\n${tail}`);
  }

  return logs.join('\n\n');
}
