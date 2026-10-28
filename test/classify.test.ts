import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { classify } from '../src/classify.ts';
import type { ClassifyInput } from '../src/classify.ts';

const base: ClassifyInput = {
  files: [{ status: 'M', path: 'src/app.ts' }],
  parents: 1,
  subject: 'Use native select on mobile',
  whitespaceOnly: false,
  repoLog: 'docs/decisions.md',
  ignore: [],
};

describe('classify', () => {
  test('an ordinary code change gets an interview', () => {
    assert.deepEqual(classify(base), { trivial: false });
  });

  test('merge commits are trivial', () => {
    assert.equal(classify({ ...base, parents: 2 }).trivial, true);
  });

  test('empty commits are trivial', () => {
    assert.equal(classify({ ...base, files: [] }).trivial, true);
  });

  test('lockfiles anywhere in the tree are trivial', () => {
    const files = [{ status: 'M', path: 'package-lock.json' }, { status: 'M', path: 'apps/web/pnpm-lock.yaml' }];
    assert.equal(classify({ ...base, files }).trivial, true);
  });

  test('a lockfile alongside real code is not trivial', () => {
    const files = [{ status: 'M', path: 'package-lock.json' }, { status: 'M', path: 'package.json' }];
    assert.deepEqual(classify({ ...base, files }), { trivial: false });
  });

  test('housekeeping files such as .gitignore, at any depth, are trivial', () => {
    const files = [{ status: 'M', path: '.gitignore' }, { status: 'A', path: 'packages/api/.gitignore' }];
    assert.equal(classify({ ...base, files }).trivial, true);
    assert.equal(classify({ ...base, files: [...files, { status: 'M', path: 'src/app.ts' }] }).trivial, false);
  });

  test('a commit that only adds decisions-log entries is trivial', () => {
    assert.equal(classify({ ...base, files: [{ status: 'M', path: 'docs/decisions.md' }] }).trivial, true);
  });

  test('why.ignore globs are honoured', () => {
    const files = [{ status: 'M', path: 'generated/api/client.ts' }];
    assert.equal(classify({ ...base, files, ignore: ['generated/**'] }).trivial, true);
  });

  test('conventional style: commits are trivial', () => {
    assert.equal(classify({ ...base, subject: 'style(ui): run prettier' }).trivial, true);
    assert.equal(classify({ ...base, subject: 'styles: new palette' }).trivial, false);
  });

  test('whitespace-only changes are trivial', () => {
    assert.equal(classify({ ...base, whitespaceOnly: true }).trivial, true);
  });
});
