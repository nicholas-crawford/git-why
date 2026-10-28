import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { classify } from './classify.ts';
import { extract, runInterview } from './claude.ts';
import { loadConfig, stateDir } from './config.ts';
import type { Config } from './config.ts';
import { formatEntry, keptDecisions, parseDecisions } from './entry.ts';
import { commitExists, diffForPrompt, readCommit, toplevel } from './git.ts';
import type { Commit } from './git.ts';
import { choose } from './keys.ts';
import { dequeue, enqueue, listQueue } from './queue.ts';

const USAGE = `usage:
  git why           interview this repo's queued commits, oldest first
  git why --all     interview queued commits in every repo
  git why --list    show how many commits are queued per repo
  git why <rev>     interview one commit, even a trivial one

skip one commit:  WHY_SKIP=1 git commit ...`;

const HOOK_MENU_TIMEOUT_MS = 20_000;

const ROOT = join(import.meta.dirname, '..');
const asset = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
const say = (msg: string): void => console.log(`git-why: ${msg}`);

/** Where the interview came from: the post-commit hook, a queue drain, or `git why <rev>`. */
type Source = 'hook' | 'drain' | 'rev';
type Outcome = 'saved' | 'skipped' | 'queued' | 'quit';

/** A full 40-character sha is unique on its own, so this also matches entries written under the old commit-why marker. */
function alreadyLogged(centralLog: string, sha: string): boolean {
  return existsSync(centralLog) && readFileSync(centralLog, 'utf8').includes(sha);
}

function appendEntry(path: string, entry: string, heading: string): void {
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) writeFileSync(path, `# ${heading}\n`);
  appendFileSync(path, `\n${entry}`);
}

function firstMessage(commit: Commit, config: Config): string {
  return [
    `Repository: ${commit.repoName}`,
    `Commit: ${commit.short}`,
    '',
    'Commit message:',
    commit.message,
    '',
    'Diffstat and diff (lockfiles excluded, may be truncated):',
    diffForPrompt(commit, config.repoLog),
    '',
    'Ask your first question.',
  ].join('\n');
}

async function interview(commit: Commit, config: Config, source: Source): Promise<Outcome> {
  const skipped = (msg: string): Outcome => {
    dequeue(commit.sha);
    say(msg);
    return 'skipped';
  };
  const later = (msg: string): Outcome => {
    enqueue(commit.toplevel, commit.sha);
    say(`${msg}; ${commit.short} is queued (run: git why)`);
    return 'queued';
  };

  if (source !== 'rev') {
    if (alreadyLogged(config.centralLog, commit.sha)) return skipped(`${commit.short} is already in the central log`);
    const verdict = classify({ ...commit, repoLog: config.repoLog, ignore: config.ignore });
    if (verdict.trivial) return skipped(`skipped ${commit.short}: ${verdict.reason} (git why ${commit.short} to force)`);
  }

  const start = await choose(
    `\nDecision interview for ${commit.repoName} ${commit.short} "${commit.subject}"?\n` +
      `[Enter] start · [s] skip · [l] later${source === 'drain' ? ' · [q] stop' : ''}`,
    {
      keys: { enter: 'start', s: 'skip', l: 'later', ...(source === 'drain' ? { q: 'quit' } : {}) } as const,
      cancel: source === 'drain' ? 'quit' : 'later',
      timeout: source === 'hook' ? { ms: HOOK_MENU_TIMEOUT_MS, choice: 'later' } : undefined,
    },
  );
  if (start === 'quit') return 'quit';
  if (start === 'skip') return skipped(`skipped ${commit.short}`);
  if (start === 'later') return later('postponed');

  // A neutral cwd keeps the repo's CLAUDE.md and settings out of the session.
  const cwd = join(stateDir(), 'sessions');
  mkdirSync(cwd, { recursive: true });
  const session = { cwd, sessionId: randomUUID(), model: config.model };

  const run = runInterview({
    ...session,
    systemPrompt: asset('prompts/interview.md').replaceAll('{{maxQuestions}}', String(config.maxQuestions)),
    firstMessage: firstMessage(commit, config),
  });
  if (!run.ok) return later(`couldn't start claude (${run.error})`);
  if (run.status !== 0) return later(`claude exited with status ${run.status}`);

  const after = await choose('\n[Enter] save · [l] later · [s] skip', {
    keys: { enter: 'save', l: 'later', s: 'skip' } as const,
    cancel: 'later',
  });
  if (after === 'skip') return skipped(`skipped ${commit.short}`);
  if (after === 'later') return later('postponed');

  say('writing up your answers…');
  const result = extract({ ...session, schema: asset('schema/entry.json'), prompt: asset('prompts/extract.md') });
  if (!result.ok) return later(`write-up failed (${result.error})`);
  const decisions = parseDecisions(result.output);
  if (!decisions) return later('write-up came back in an unexpected shape');
  const kept = keptDecisions(decisions);
  if (kept.length === 0) return skipped('no reasons given, so there is nothing to record');

  const entry = formatEntry(
    { date: commit.date, repo: commit.repoName, sha: commit.sha, short: commit.short, subject: commit.subject },
    kept,
  );
  console.log(`\n${entry}`);
  const confirm = await choose('[Enter] write to both logs · [d] discard · [l] later', {
    keys: { enter: 'write', d: 'discard', l: 'later' } as const,
    cancel: 'later',
  });
  if (confirm === 'discard') return skipped(`discarded ${commit.short}`);
  if (confirm === 'later') return later('postponed');

  const repoLog = join(commit.toplevel, config.repoLog);
  appendEntry(repoLog, entry, 'Decisions');
  appendEntry(config.centralLog, entry, 'Decisions (all repos)');
  dequeue(commit.sha);
  say(`saved to ${config.repoLog} and ${config.centralLog}`);
  return 'saved';
}

async function hook(sha: string | undefined): Promise<number> {
  const commit = sha ? readCommit(process.cwd(), sha) : null;
  if (!commit) return 1; // the shim queues it
  await interview(commit, loadConfig(commit.toplevel), 'hook');
  return 0;
}

async function drain(repo: string | null): Promise<number> {
  const items = listQueue().filter((item) => repo === null || item.repo === repo);
  if (items.length === 0) {
    say(repo ? 'nothing queued for this repo' : 'nothing queued');
    return 0;
  }
  for (const [i, item] of items.entries()) {
    console.log(`\n[${i + 1}/${items.length}] ${basename(item.repo)}`);
    const commit = existsSync(item.repo) && commitExists(item.repo, item.sha) ? readCommit(item.repo, item.sha) : null;
    if (!commit) {
      dequeue(item.sha);
      say(`dropped ${item.sha.slice(0, 7)}: the commit no longer exists (rebased or deleted)`);
      continue;
    }
    if ((await interview(commit, loadConfig(commit.toplevel), 'drain')) === 'quit') {
      say(`stopped; ${items.length - i} left in the queue`);
      break;
    }
  }
  return 0;
}

function list(): number {
  const counts = new Map<string, number>();
  for (const item of listQueue()) counts.set(item.repo, (counts.get(item.repo) ?? 0) + 1);
  if (counts.size === 0) say('nothing queued');
  for (const [repo, count] of counts) console.log(`${String(count).padStart(4)}  ${repo}`);
  return 0;
}

async function one(rev: string): Promise<number> {
  const top = toplevel(process.cwd());
  const commit = top ? readCommit(top, rev) : null;
  if (!commit) {
    say(top ? `unknown commit: ${rev}` : 'not in a git repository');
    return 1;
  }
  await interview(commit, loadConfig(commit.toplevel), 'rev');
  return 0;
}

async function main([cmd, ...rest]: string[]): Promise<number> {
  if (cmd === '-h' || cmd === '--help') {
    console.log(USAGE);
    return 0;
  }
  if (cmd === 'hook') return hook(rest[0]);
  if (cmd === '--list') return list();
  if (!process.stdin.isTTY) {
    say('the interview needs an interactive terminal');
    return 1;
  }
  if (cmd === '--all') return drain(null);
  if (cmd === undefined) {
    const top = toplevel(process.cwd());
    if (!top) {
      say('not in a git repository (try git why --all or --list)');
      return 1;
    }
    return drain(top);
  }
  if (cmd.startsWith('-')) {
    console.error(USAGE);
    return 1;
  }
  return one(cmd);
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    console.error(`git-why: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  },
);
