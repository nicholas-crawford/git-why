import { homedir } from 'node:os';
import { join } from 'node:path';
import { gitConfig, gitConfigAll } from './git.ts';

export interface Config {
  centralLog: string;
  repoLog: string;
  model: string;
  maxQuestions: number;
  ignore: string[];
  mode: 'interview' | 'template';
  templateDir: string
}

export const DEFAULT_CENTRAL_LOG = join(homedir(), 'Documents', 'decisions', 'decisions.md');

export function parseMode(value: string | null): Config['mode'] {
  if (value === null || value === 'interview') return 'interview';
  if (value === 'template') return 'template';
  throw new Error(`why.mode must be "interview" or "template", got "${value}"`);
}

/** Settings live in git config, so a repo's local value overrides the global one for free. */
export function loadConfig(repo: string): Config {
  const maxQuestions = Number(gitConfig(repo, 'why.maxQuestions', 'int'));
  return {
    // --type=path makes git expand a leading ~ for us.
    centralLog: gitConfig(repo, 'why.centralLog', 'path') ?? DEFAULT_CENTRAL_LOG,
    repoLog: gitConfig(repo, 'why.repoLog') ?? 'docs/decisions.md',
    model: gitConfig(repo, 'why.model') ?? 'sonnet',
    maxQuestions: maxQuestions > 0 ? maxQuestions : 5,
    ignore: gitConfigAll(repo, 'why.ignore'),
    mode: parseMode(gitConfig(repo, 'why.mode')),
    templateDir: gitConfig(repo, 'why.templateDir') ?? 'docs/decisions.md'
  };
}

export function stateDir(): string {
  return join(process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state'), 'git-why');
}
