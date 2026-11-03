import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseArgs } from '../src/args.ts';

describe('parseArgs', () => {
  test('no mode flag leaves the mode to git config', () => {
    assert.deepEqual(parseArgs(['a1b2c3d']), { mode: null, args: ['a1b2c3d'] });
    assert.deepEqual(parseArgs([]), { mode: null, args: [] });
  });

  test('--template and --interview set the mode, before or after the command', () => {
    assert.deepEqual(parseArgs(['--template', 'a1b2c3d']), { mode: 'template', args: ['a1b2c3d'] });
    assert.deepEqual(parseArgs(['--all', '--interview']), { mode: 'interview', args: ['--all'] });
    assert.deepEqual(parseArgs(['--template']), { mode: 'template', args: [] });
  });

  test('repeating the same flag is fine, mixing them is an error', () => {
    assert.equal(parseArgs(['--template', '--template']).mode, 'template');
    assert.throws(() => parseArgs(['--template', '--interview']), /can't be used together/);
  });

  test('a rev that happens to be an Object.prototype key is not a flag', () => {
    assert.deepEqual(parseArgs(['constructor']), { mode: null, args: ['constructor'] });
  });
});
