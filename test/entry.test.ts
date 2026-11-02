import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { formatEntry, formatTemplate, keptDecisions, parseDecisions } from '../src/entry.ts';
import type { Decision } from '../src/entry.ts';

const meta = { date: '2026-10-28', repo: 'shop', sha: 'a'.repeat(40), short: 'aaaaaaa', subject: 'Native select on mobile' };

const full: Decision = {
  decision: 'Replaced the custom dropdown with a native <select> on mobile',
  why: 'screen reader support was broken; fixing the custom one was a week of work',
  rejected: 'patching ARIA on the custom component, too fragile across browsers',
  tradeoff: 'less styling control on mobile',
  tags: ['accessibility', 'pragmatism'],
};

describe('formatEntry', () => {
  test('renders the target format with repo, hash and date', () => {
    assert.equal(
      formatEntry(meta, [full]),
      [
        '## 2026-10-28 · shop · aaaaaaa',
        `<!-- git-why ${'a'.repeat(40)} -->`,
        'Native select on mobile',
        '',
        '- Decision: Replaced the custom dropdown with a native <select> on mobile',
        '  - Why: screen reader support was broken; fixing the custom one was a week of work',
        '  - Rejected: patching ARIA on the custom component, too fragile across browsers',
        '  - Tradeoff: less styling control on mobile',
        '  - Tags: accessibility, pragmatism',
        '',
      ].join('\n'),
    );
  });

  test('leaves out fields the engineer did not answer', () => {
    const out = formatEntry(meta, [{ ...full, rejected: null, tradeoff: '  ', tags: [] }]);
    assert.doesNotMatch(out, /Rejected|Tradeoff|Tags/);
    assert.match(out, /Why: screen reader/);
  });
});

describe('formatTemplate', () => {
  const out = formatTemplate(meta);

  test('starts with the same header as a real entry', () => {
    assert.ok(out.startsWith(formatEntry(meta, [])), out);
  });

  test('carries the full sha marker, so the commit can be found from the file', () => {
    assert.ok(out.includes(`<!-- git-why ${'a'.repeat(40)} -->`));
  });

  test('has every field label, in the same order as a real entry', () => {
    const labels = ['- Decision:', '  - Why:', '  - Rejected:', '  - Tradeoff:', '  - Tags:'];
    const positions = labels.map((label) => out.indexOf(label));
    assert.ok(positions.every((p) => p !== -1), `missing a label in:\n${out}`);
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  });

  test('ends with a single newline', () => {
    assert.ok(out.endsWith('\n') && !out.endsWith('\n\n'));
  });
});

describe('keptDecisions', () => {
  test('drops decisions with no reasoning at all', () => {
    const bare = { ...full, why: null, rejected: null, tradeoff: null };
    assert.deepEqual(keptDecisions([bare, full]), [full]);
  });

  test('keeps a stated lack of reason', () => {
    const stated = { ...full, why: 'no particular reason (stated)', rejected: null, tradeoff: null };
    assert.deepEqual(keptDecisions([stated]), [stated]);
  });
});

describe('parseDecisions', () => {
  test('accepts the schema shape', () => {
    assert.deepEqual(parseDecisions({ decisions: [full] }), [full]);
  });

  test('rejects anything else', () => {
    assert.equal(parseDecisions({ decisions: [{ ...full, why: 3 }] }), null);
    assert.equal(parseDecisions({ decisions: 'none' }), null);
    assert.equal(parseDecisions(null), null);
  });
});
