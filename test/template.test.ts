import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { commit, tempRepo } from './helpers.ts';
import { readCommit } from '../src/git.ts';
import { createTemplate, templateExists, templatePath } from '../src/template.ts';

function committed(files: Record<string, string> = { 'a.ts': 'export const a = 1;\n' }) {
  const repo = tempRepo();
  commit(repo, files, 'Use native select on mobile');
  const c = readCommit(repo, 'HEAD');
  assert.ok(c);
  return c;
}

describe('templatePath', () => {
  test('is <templateDir>/<date>-<short>.md, relative for messages and absolute for the fs', () => {
    const c = committed();
    const { rel, abs } = templatePath(c, 'docs/decisions');
    assert.equal(rel, join('docs/decisions', `${c.date}-${c.short}.md`));
    assert.equal(abs, join(c.toplevel, rel));
    assert.match(c.date, /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('createTemplate', () => {
  test('creates the directory and writes the blank template with the full sha marker', () => {
    const c = committed();
    assert.equal(templateExists(c, 'docs/decisions'), false);
    assert.equal(createTemplate(c, 'docs/decisions'), 'created');
    assert.equal(templateExists(c, 'docs/decisions'), true);
    const text = readFileSync(templatePath(c, 'docs/decisions').abs, 'utf8');
    for (const part of [`<!-- git-why ${c.sha} -->`, c.subject, '- Decision:', '  - Why:']) {
      assert.ok(text.includes(part), `missing ${part}`);
    }
  });

  test('never overwrites an existing template, even a half-filled one', () => {
    const c = committed();
    createTemplate(c, 'docs/decisions');
    const { abs } = templatePath(c, 'docs/decisions');
    writeFileSync(abs, '- Decision: keep the native select\n');
    assert.equal(createTemplate(c, 'docs/decisions'), 'exists');
    assert.equal(readFileSync(abs, 'utf8'), '- Decision: keep the native select\n');
  });

  test('a file where the directory should be is an error, not "already exists"', () => {
    const c = committed({ 'a.ts': '1\n', 'docs/decisions.md': '# Decisions\n' });
    assert.throws(() => createTemplate(c, 'docs/decisions.md'), { code: 'EEXIST', syscall: 'mkdir' });
  });
});
