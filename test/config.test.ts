import {afterEach, describe, test} from "node:test";

import {git, tempRepo} from "./helpers.ts";
import assert from "node:assert/strict";
import {loadConfig} from "../src/config.ts";

describe('config', () => {
    afterEach(() => {
        const repo = tempRepo();
        try { git(repo, ['config', '--global', '--unset-all', 'why.mode']) } catch { /* not set */ }
    });

    test('a global mode applies when the repo sets none', () => {
        const repo = tempRepo();
        git(repo, ['config', '--global', 'why.mode', 'template'])
        assert.equal(loadConfig(repo).mode, 'template')
    });
    test('a local mode overrides the global one', () => {
        const repo = tempRepo();
        git(repo, ['config', '--global', 'why.mode', 'template'])
        git(repo, ['config', 'why.mode', 'interview'])
        assert.equal(loadConfig(repo).mode, 'interview')
    });
    test('templateDir defaults to docs/decisions', () => {
        const repo = tempRepo();
        assert.equal(loadConfig(repo).templateDir, 'docs/decisions')
    });
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
    test('incorrect directory for template should result in error', () => {
        const repo = tempRepo();
        git(repo, ['config', 'why.templateDir', './desw'])
        assert.throws(() => loadConfig(repo).templateDir, /error/)
    })
})
