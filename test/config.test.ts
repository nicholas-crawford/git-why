import {describe, test} from "node:test";

import {git, tempRepo} from "./helpers.ts";
import assert from "node:assert/strict";
import {loadConfig} from "../src/config.ts";

describe('config', () => {
    test('setting template mode should result in template mode', () => {
        const repo = tempRepo();
        git(repo, ['config', 'why.mode', 'template'])
        assert.equal(loadConfig(repo).mode, 'template')
    });
    test('setting interview mode should result in interview mode', () => {
        const repo = tempRepo();
        git(repo, ['config', 'why.mode', 'interview'])
        assert.equal(loadConfig(repo).mode, 'interview')
    });
    test('default mode should be interview', () => {
        const repo = tempRepo();
        assert.equal(loadConfig(repo).mode, 'interview')
    });
    test('blank should result in error', () => {
        const repo = tempRepo();
        git(repo, ['config', 'why.mode', ''])
        assert.throws(() => loadConfig(repo).mode, /got ""/)
    })
    test('misspelling should result in error', () => {
        const repo = tempRepo();
        git(repo, ['config', 'why.mode', 'intervi'])
        assert.throws(() => loadConfig(repo).mode, /got "intervi"/)
    });
})
