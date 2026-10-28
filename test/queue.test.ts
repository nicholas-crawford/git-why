import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, test } from 'node:test';
import './helpers.ts';
import { stateDir } from '../src/config.ts';
import { dequeue, enqueue, listQueue } from '../src/queue.ts';

describe('queue', () => {
  beforeEach(() => {
    for (const item of listQueue()) dequeue(item.sha);
  });

  test('round-trips items, oldest first', async () => {
    enqueue('/repos/a', '1'.repeat(40));
    await new Promise((r) => setTimeout(r, 5));
    enqueue('/repos/b', '2'.repeat(40));
    assert.deepEqual(listQueue().map((i) => [i.repo, i.sha]), [
      ['/repos/a', '1'.repeat(40)],
      ['/repos/b', '2'.repeat(40)],
    ]);
  });

  test('queueing the same commit twice keeps one entry', () => {
    enqueue('/repos/a', '3'.repeat(40));
    enqueue('/repos/a', '3'.repeat(40));
    assert.equal(listQueue().length, 1);
  });

  test('ignores half-written temp files', () => {
    enqueue('/repos/a', '4'.repeat(40));
    writeFileSync(join(stateDir(), 'queue', `${'5'.repeat(40)}.123.tmp`), '/repos/a\n');
    assert.deepEqual(listQueue().map((i) => i.sha), ['4'.repeat(40)]);
  });

  test('dequeue removes the item and tolerates a missing one', () => {
    enqueue('/repos/a', '6'.repeat(40));
    dequeue('6'.repeat(40));
    dequeue('6'.repeat(40));
    assert.deepEqual(listQueue(), []);
  });
});
