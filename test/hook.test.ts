import assert from 'node:assert/strict';
import { existsSync, readFileSync, appendFileSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, test } from 'node:test';
import { commit, git, globalConfig, tempRepo } from './helpers.ts';
import { stateDir } from '../src/config.ts';
import { dequeue, listQueue } from '../src/queue.ts';

const hook = join(import.meta.dirname, '..', 'bin', 'post-commit');

// Install the hook the way install.sh does, but into the sandboxed global
// config. WHY_FORCE_QUEUE stops it opening an interview when the test runner
// itself has a terminal.
appendFileSync(globalConfig, `[hook "git-why"]\n\tcommand = ${hook}\n\tevent = post-commit\n`);
const env = { WHY_FORCE_QUEUE: '1' };

const head = (repo: string): string => git(repo, ['rev-parse', 'HEAD']).stdout;

describe('post-commit hook', () => {
  beforeEach(() => {
    for (const item of listQueue()) dequeue(item.sha);
  });

  test('queues the commit and says so, without failing it', () => {
    const repo = tempRepo();
    const stderr = commit(repo, { 'a.ts': '1\n' }, 'Add a', env);
    const sha = head(repo);
    assert.match(stderr, /git-why: queued [0-9a-f]{7}/);
    const spool = readFileSync(join(stateDir(), 'queue', sha), 'utf8').split('\n');
    assert.equal(spool[1], sha);
    assert.equal(spool[0], git(repo, ['rev-parse', '--show-toplevel']).stdout);
  });

  test('WHY_SKIP skips one commit and queues nothing', () => {
    const repo = tempRepo();
    const stderr = commit(repo, { 'a.ts': '1\n' }, 'Add a', { ...env, WHY_SKIP: '1' });
    assert.match(stderr, /skipped \(WHY_SKIP\)/);
    assert.deepEqual(listQueue(), []);
  });

  test('amends are skipped', () => {
    const repo = tempRepo();
    commit(repo, { 'a.ts': '1\n' }, 'Add a', env);
    const { stderr } = git(repo, ['commit', '-q', '--amend', '-m', 'Add a, reworded'], env);
    assert.match(stderr, /skipped [0-9a-f]{7} \(commit \(amend\)\)/);
    assert.equal(existsSync(join(stateDir(), 'queue', head(repo))), false);
  });

  test('rebase picks are skipped', () => {
    const repo = tempRepo();
    commit(repo, { 'a.ts': '1\n' }, 'Add a', env);
    git(repo, ['checkout', '-q', '-b', 'feature']);
    commit(repo, { 'b.ts': '1\n' }, 'Add b', env);
    git(repo, ['checkout', '-q', 'main']);
    commit(repo, { 'c.ts': '1\n' }, 'Add c', env);
    for (const item of listQueue()) dequeue(item.sha);
    const { stderr } = git(repo, ['rebase', '-q', 'main', 'feature'], env);
    assert.match(stderr, /skipped [0-9a-f]{7} \(rebase/);
    assert.deepEqual(listQueue(), []);
  });

  test('runs alongside a repo hooks dir such as husky’s', () => {
    const repo = tempRepo();
    const hooksDir = join(repo, '.husky', '_');
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, 'post-commit'), '#!/bin/sh\ntouch "$(git rev-parse --show-toplevel)/.repo-hook-ran"\n');
    chmodSync(join(hooksDir, 'post-commit'), 0o755);
    git(repo, ['config', 'core.hooksPath', '.husky/_']);
    const stderr = commit(repo, { 'a.ts': '1\n' }, 'Add a', env);
    assert.match(stderr, /queued/);
    assert.equal(existsSync(join(repo, '.repo-hook-ran')), true);
  });

  test('a per-repo opt-out disables it', () => {
    const repo = tempRepo();
    git(repo, ['config', 'hook.git-why.enabled', 'false']);
    const stderr = commit(repo, { 'a.ts': '1\n' }, 'Add a', env);
    assert.doesNotMatch(stderr, /git-why/);
    assert.deepEqual(listQueue(), []);
  });
});
