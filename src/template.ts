import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { formatTemplate } from './entry.ts';
import type { Commit } from './git.ts';

export function templatePath(commit: Commit, templateDir: string): { rel: string; abs: string } {
  const rel = join(templateDir, `${commit.date}-${commit.short}.md`);
  return { rel, abs: join(commit.toplevel, rel) };
}

export function templateExists(commit: Commit, templateDir: string): boolean {
  return existsSync(templatePath(commit, templateDir).abs);
}

export function createTemplate(commit: Commit, templateDir: string): 'created' | 'exists' {
  const { abs } = templatePath(commit, templateDir);
  mkdirSync(dirname(abs), { recursive: true });
  const text = formatTemplate({
    date: commit.date,
    repo: commit.repoName,
    sha: commit.sha,
    short: commit.short,
    subject: commit.subject,
  });
  try {
    writeFileSync(abs, text, { flag: 'wx' });
    return 'created';
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') return 'exists';
    throw err;
  }
}
