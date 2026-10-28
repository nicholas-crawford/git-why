import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { commit, git, tempRepo } from './helpers.ts';
import { classify } from '../src/classify.ts';
import { diffForPrompt, readCommit } from '../src/git.ts';

describe('readCommit', () => {
  test('reads the root commit', () => {
    const repo = tempRepo();
    commit(repo, { 'a.ts': 'export const a = 1;\n' }, 'Initial commit');
    const c = readCommit(repo, 'HEAD');
    assert.ok(c);
    assert.equal(c.parents, 0);
    assert.equal(c.subject, 'Initial commit');
    assert.deepEqual(c.files, [{ status: 'A', path: 'a.ts' }]);
    assert.equal(c.whitespaceOnly, false);
  });

  test('flags whitespace-only edits so they classify as trivial', () => {
    const repo = tempRepo();
    commit(repo, { 'a.ts': 'if (x) {\nrun();\n}\n' }, 'Add a');
    commit(repo, { 'a.ts': 'if (x) {\n  run();\n}\n\n' }, 'Indent a');
    const c = readCommit(repo, 'HEAD');
    assert.ok(c);
    assert.equal(c.whitespaceOnly, true);
    assert.equal(classify({ ...c, repoLog: 'docs/decisions.md', ignore: [] }).trivial, true);
  });

  test('a pure rename is not whitespace-only', () => {
    const repo = tempRepo();
    commit(repo, { 'a.ts': 'export const a = 1;\n' }, 'Add a');
    git(repo, ['mv', 'a.ts', 'b.ts']);
    git(repo, ['commit', '-q', '-m', 'Rename a to b']);
    const c = readCommit(repo, 'HEAD');
    assert.ok(c);
    assert.deepEqual(c.files.map((f) => f.status), ['R']);
    assert.equal(c.whitespaceOnly, false);
  });

  test('returns null for an unknown revision', () => {
    const repo = tempRepo();
    commit(repo, { 'a.ts': '1\n' }, 'Add a');
    assert.equal(readCommit(repo, 'nope'), null);
  });
});

describe('diffForPrompt', () => {
  test('leaves out lockfiles and the decisions log', () => {
    const repo = tempRepo();
    commit(
      repo,
      { 'src.ts': 'export {};\n', 'package-lock.json': '{}\n', 'docs/decisions.md': '# Decisions\n' },
      'Add things',
    );
    const c = readCommit(repo, 'HEAD');
    assert.ok(c);
    const diff = diffForPrompt(c, 'docs/decisions.md');
    assert.match(diff, /src\.ts/);
    assert.doesNotMatch(diff, /package-lock\.json|decisions\.md/);
  });
});
