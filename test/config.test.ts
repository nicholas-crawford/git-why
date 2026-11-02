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
    test('repoLog is normalised, so classify still recognises it', () => {
        for (const [value, expected] of [
            ['./docs/decisions.md', 'docs/decisions.md'],
            ['docs//decisions.md', 'docs/decisions.md'],
        ]) {
            const repo = tempRepo();
            git(repo, ['config', 'why.repoLog', value])
            assert.equal(loadConfig(repo).repoLog, expected, `for "${value}"`)
        }
    })
    test('repoLog outside the repo is an error', () => {
        for (const value of ['', '/tmp/decisions.md', '../decisions.md']) {
            const repo = tempRepo();
            git(repo, ['config', 'why.repoLog', value])
            assert.throws(() => loadConfig(repo), /why\.repoLog must be a file inside the repo/, `for "${value}"`)
        }
    })
    test('templateDir is normalised to the repo-relative form git reports', () => {
        for (const [value, expected] of [
            ['./adr', 'adr'],
            ['docs/decisions/', 'docs/decisions'],
            ['docs//decisions', 'docs/decisions'],
            ['docs/./decisions', 'docs/decisions'],
        ]) {
            const repo = tempRepo();
            git(repo, ['config', 'why.templateDir', value])
            assert.equal(loadConfig(repo).templateDir, expected, `for "${value}"`)
        }
    })
    test('templateDir outside the repo, or the repo root itself, is an error', () => {
        for (const value of ['', '.', './', '/tmp/decisions', '../decisions', 'docs/../../decisions']) {
            const repo = tempRepo();
            git(repo, ['config', 'why.templateDir', value])
            assert.throws(() => loadConfig(repo), /why\.templateDir must be a directory inside the repo/, `for "${value}"`)
        }
    })
})
