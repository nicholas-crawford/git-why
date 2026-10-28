import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import { LOCKFILES } from './classify.ts';
import type { ChangedFile } from './classify.ts';

const MAX_DIFF_LINES = 1500;

export function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd();
}

export function tryGit(repo: string, args: string[]): string | null {
  try {
    return git(repo, args);
  } catch {
    return null;
  }
}

export function gitConfig(repo: string, key: string, type?: 'path' | 'int'): string | null {
  return tryGit(repo, ['config', ...(type ? [`--type=${type}`] : []), '--get', key]);
}

export function gitConfigAll(repo: string, key: string): string[] {
  return tryGit(repo, ['config', '--get-all', key])?.split('\n').filter(Boolean) ?? [];
}

export function toplevel(dir: string): string | null {
  return tryGit(dir, ['rev-parse', '--show-toplevel']);
}

export interface Commit {
  sha: string;
  short: string;
  /** Committer date, YYYY-MM-DD. */
  date: string;
  parents: number;
  subject: string;
  message: string;
  files: ChangedFile[];
  /** True when ignoring whitespace and blank lines leaves no hunks. */
  whitespaceOnly: boolean;
  toplevel: string;
  repoName: string;
}

export function readCommit(repo: string, rev: string): Commit | null {
  const top = toplevel(repo);
  const head = top && tryGit(top, ['show', '-s', '--format=%H%x00%h%x00%cs%x00%P%x00%s%x00%B', `${rev}^{commit}`]);
  if (!top || !head) return null;
  const [sha, short, date, parentList, subject, message] = head.split('\0');

  const files = git(top, ['diff-tree', '-r', '--root', '-M', '--no-commit-id', '--name-status', sha])
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      // Renames and copies list old and new paths; the new one is what matters.
      return { status: parts[0][0], path: parts[parts.length - 1] };
    });

  const wsDiff = git(top, ['diff-tree', '-p', '-w', '--ignore-blank-lines', '--root', '--no-commit-id', sha]);
  const whitespaceOnly =
    files.length > 0 && files.every((f) => f.status === 'M') && !/^@@/m.test(wsDiff);

  return {
    sha,
    short,
    date,
    parents: parentList.split(' ').filter(Boolean).length,
    subject,
    message: message.trim(),
    files,
    whitespaceOnly,
    toplevel: top,
    repoName: basename(top),
  };
}

/** Diffstat plus patch for the prompt, minus lockfiles and the decisions log, capped in length. */
export function diffForPrompt(commit: Commit, repoLog: string): string {
  const excludes = [...LOCKFILES.map((f) => `:(exclude,glob)**/${f}`), `:(exclude)${repoLog}`];
  const out = git(commit.toplevel, [
    'show', '--format=', '--stat', '--patch', '-M', '--root', commit.sha, '--', '.', ...excludes,
  ]);
  const lines = out.split('\n');
  if (lines.length <= MAX_DIFF_LINES) return out;
  return [...lines.slice(0, MAX_DIFF_LINES), `[diff truncated: ${lines.length - MAX_DIFF_LINES} more lines]`].join('\n');
}

export function commitExists(repo: string, sha: string): boolean {
  return tryGit(repo, ['cat-file', '-e', `${sha}^{commit}`]) !== null;
}
