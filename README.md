# git-why

A git `post-commit` hook that interviews you about the decisions in each commit (what you chose, why, what you rejected, what tradeoff you accepted) and appends your answers as dot points to a decisions log in the repo and to one central log across all your repos.

```md
## 2026-10-28 · shop · a1b2c3d
<!-- git-why a1b2c3d… -->
Use native select on mobile

- Decision: Replaced the custom dropdown with a native <select> on mobile
  - Why: screen reader support was broken; fixing the custom one was a week of work
  - Rejected: patching ARIA on the custom component, too fragile across browsers
  - Tradeoff: less styling control on mobile
  - Tags: accessibility, pragmatism
```

Only reasons you actually gave are recorded. The interviewer is told not to suggest reasons, every field can be empty, and you see the entry before anything is written.

## Requirements

- git with config-based hooks (`hook.<name>.command`). Apple git 2.54 and Homebrew git 2.55 both have them; `install.sh` checks.
- Node 22.18+ (runs the TypeScript source directly, no build step).
- [Claude Code](https://claude.com/claude-code), logged in. Interviews use your normal Claude Code login.

## Install

```sh
git clone <this repo> ~/Documents/side_code/git-why
~/Documents/side_code/git-why/install.sh
```

This adds a `[hook "git-why"]` section to your global git config and links `git why` into `~/.local/bin` (override with `BIN_DIR=…`). Nothing is set up per repo. The hook runs *alongside* each repo's own hooks, including husky and lint-staged setups that set `core.hooksPath`, because config-based hooks don't go through the hooks directory.

`./uninstall.sh` removes both. Your logs, settings and queue stay.

## How it works

After every commit:

1. **Skipped** if `WHY_SKIP=1` is set, or if the commit is an amend, rebase pick, cherry-pick or merge.
2. **No terminal** (WebStorm's commit dialog, Claude Code's Bash tool, CI)? The commit is **queued** and git prints `git-why: queued a1b2c3d…`. Nothing else happens.
3. **In a terminal:** trivial commits are skipped with a one-line note. A commit is trivial if it's whitespace-only, a `style:` commit, or only touches lockfiles, housekeeping files (`.gitignore`, `.gitattributes`, `.editorconfig`, …), the decisions log or `why.ignore` paths. Otherwise:
   ```
   Decision interview for shop a1b2c3d "Use native select on mobile"?
   [Enter] start · [s] skip · [l] later
   ```
   With no key pressed for 20 seconds, it queues the commit.
4. Claude asks up to 5 questions, one at a time, then tells you to `/exit` (or press Ctrl+D). Leave early the same way. On your very first interview, Claude Code asks whether to trust `~/.local/state/git-why/sessions`. Choose **Yes**. The default, "No, exit", ends the interview and queues the commit. The folder is empty, and the interview has no tools to use in it.
5. `[Enter] save · [l] later · [s] skip`. On save, your answers are written up, previewed, and appended to both logs after you confirm.

If anything fails (claude missing, network down, a crash), the commit is queued. The hook never fails a commit: it runs after the commit exists, and git ignores its exit status anyway.

### The queue

```sh
git why            # interview this repo's queued commits, oldest first
git why --all      # every repo
git why --list     # counts per repo
git why <rev>      # interview any commit, even a trivial one
```

The queue is a spool directory, one file per commit, in `~/.local/state/git-why/queue/`. Commits that were rebased away are dropped when you drain.

### Skipping

- One key at either menu (`s`).
- One commit: `WHY_SKIP=1 git commit …`
- Always queue, never interview at commit time: `export WHY_FORCE_QUEUE=1`
- Turn it off for one repo: `git config hook.git-why.enabled false`

## Configuration

Plain git config: set globally with `--global`, override per repo without it.

| Key | Default | |
|---|---|---|
| `why.centralLog` | `~/Documents/decisions/decisions.md` | central log, all repos |
| `why.repoLog` | `docs/decisions.md` | in-repo log, relative to the repo root |
| `why.model` | `sonnet` | any `claude --model` value |
| `why.maxQuestions` | `5` | |
| `why.ignore` | (none) | extra paths that don't count as real changes; repeat for several globs, e.g. `git config --global --add why.ignore 'generated/**'` |

The in-repo log is meant to be committed. An entry is written after its commit, so it goes in with your next one. Commits that only touch the log don't trigger an interview.

## Cost

Each interview runs Claude Code with `--safe-mode --tools ''` and its own system prompt, from a neutral directory. It loads no CLAUDE.md, hooks, MCP servers or tools, so the context is the prompt, a diff capped at 1,500 lines (lockfiles excluded) and your answers. A five-question interview on a small diff measured $0.03–0.07 at Sonnet list prices. On a Claude subscription it counts against your usage limits instead.

## Development

```sh
npm install        # TypeScript and @types/node, for typechecking only
npm test           # node:test, including real commits through the hook in temp repos
npm run typecheck
```
