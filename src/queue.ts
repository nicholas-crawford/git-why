import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stateDir } from './config.ts';

// Same spool format bin/post-commit writes: one file per commit, named by sha,
// holding repo path, sha and queued-at time on three lines.

export interface QueueItem {
  repo: string;
  sha: string;
  queuedAt: string;
}

const queueDir = (): string => join(stateDir(), 'queue');

export function enqueue(repo: string, sha: string): void {
  const dir = queueDir();
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `${sha}.${process.pid}.tmp`);
  writeFileSync(tmp, `${repo}\n${sha}\n${new Date().toISOString()}\n`);
  renameSync(tmp, join(dir, sha));
}

export function dequeue(sha: string): void {
  rmSync(join(queueDir(), sha), { force: true });
}

export function listQueue(): QueueItem[] {
  let names: string[];
  try {
    names = readdirSync(queueDir());
  } catch {
    return [];
  }
  const items: QueueItem[] = [];
  for (const name of names) {
    if (name.endsWith('.tmp')) continue;
    try {
      const [repo, sha, queuedAt] = readFileSync(join(queueDir(), name), 'utf8').split('\n');
      if (repo && sha) items.push({ repo, sha, queuedAt: queuedAt ?? '' });
    } catch {
      // Removed by another `git why` between readdir and read.
    }
  }
  return items.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}
