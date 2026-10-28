import { basename, matchesGlob } from 'node:path';

export const LOCKFILES = [
  'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb',
  'deno.lock', 'Cargo.lock', 'Gemfile.lock', 'poetry.lock', 'uv.lock', 'Pipfile.lock', 'composer.lock',
  'go.sum', 'flake.lock', 'Podfile.lock', 'pubspec.lock', 'mix.lock',
];

/** Repo housekeeping: changing these alone isn't an engineering decision worth an interview. */
export const HOUSEKEEPING = ['.gitignore', '.gitattributes', '.gitkeep', '.editorconfig', '.mailmap', '.DS_Store'];

export interface ChangedFile {
  /** First letter of git's --name-status: A, M, D, R, C, T. */
  status: string;
  path: string;
}

export interface ClassifyInput {
  files: ChangedFile[];
  parents: number;
  subject: string;
  whitespaceOnly: boolean;
  /** The in-repo decisions log, so a commit that only adds entries doesn't trigger another interview. */
  repoLog: string;
  /** Extra globs from `why.ignore`. */
  ignore: string[];
}

export type Verdict = { trivial: false } | { trivial: true; reason: string };

function ignored(path: string, input: ClassifyInput): boolean {
  return (
    LOCKFILES.includes(basename(path)) ||
    HOUSEKEEPING.includes(basename(path)) ||
    path === input.repoLog ||
    input.ignore.some((glob) => matchesGlob(path, glob))
  );
}

export function classify(input: ClassifyInput): Verdict {
  if (input.parents > 1) return { trivial: true, reason: 'merge commit' };
  if (input.files.length === 0) return { trivial: true, reason: 'no file changes' };
  if (input.files.every((f) => ignored(f.path, input))) {
    return { trivial: true, reason: 'only lockfiles, housekeeping files (.gitignore etc.), the decisions log or ignored paths' };
  }
  if (/^style(\([^)]*\))?!?:/i.test(input.subject)) return { trivial: true, reason: 'style: commit' };
  if (input.whitespaceOnly) return { trivial: true, reason: 'whitespace-only changes' };
  return { trivial: false };
}
