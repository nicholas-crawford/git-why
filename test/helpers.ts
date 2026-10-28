import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

// Isolate every git call in the tests from the machine's real config, so an
// installed git-why hook never fires and no real identity is needed.
export const sandbox = mkdtempSync(join(tmpdir(), 'git-why-test-'));
export const globalConfig = join(sandbox, 'gitconfig');
writeFileSync(globalConfig, '[user]\n\tname = Test\n\temail = test@example.com\n[init]\n\tdefaultBranch = main\n');
process.env.GIT_CONFIG_GLOBAL = globalConfig;
process.env.GIT_CONFIG_NOSYSTEM = '1';
process.env.XDG_STATE_HOME = join(sandbox, 'state');

export function tempRepo(): string {
  const dir = mkdtempSync(join(sandbox, 'repo-'));
  git(dir, ['init', '-q']);
  return dir;
}

/** Run git, returning stdout and stderr. Hook output lands on stderr. */
export function git(repo: string, args: string[], env: Record<string, string> = {}): { stdout: string; stderr: string } {
  const r = spawnSync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return { stdout: r.stdout.trim(), stderr: r.stderr };
}

export function write(repo: string, files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), content);
  }
}

/** Write files, stage everything and commit. Returns the commit's stderr. */
export function commit(repo: string, files: Record<string, string>, message: string, env: Record<string, string> = {}): string {
  write(repo, files);
  git(repo, ['add', '-A']);
  return git(repo, ['commit', '-q', '--allow-empty', '-m', message], env).stderr;
}
