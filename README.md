# DevAssist

A VS Code chat extension that generates Pytest tests, READMEs, coverage advice,
and style reviews, **using the Copilot models you already have**.

## What it actually is

DevAssist is a thin wrapper. It does **not** ship or call its own AI model.
Every command takes your editor/workspace state, builds a carefully structured
prompt, and hands that prompt to a Copilot chat model through VS Code's stable
[`vscode.lm`](https://code.visualstudio.com/api/extension-guides/language-model)
API. The model's answer is streamed straight back into the chat.

In other words: the value here is the **prompts and the plumbing**, not a new
model. You get a few opinionated, repeatable commands (like `/tests` for Python)
layered on top of the Copilot subscription your organization already trusts.

```
your code ──▶ DevAssist builds a prompt ──▶ vscode.lm (your Copilot model) ──▶ chat
```

## Data protection

This is the whole reason DevAssist is built the way it is.

- **Your code stays on your Copilot plan.** Requests go through `vscode.lm`, so
  they run against the Copilot models provisioned for your account, including
  **Copilot Enterprise/Business**, where they inherit your organization's data
  handling, retention, and "no training on your code" guarantees. DevAssist
  adds no endpoint of its own in the editor.
- **No third-party model service.** There is no hidden API key, no default
  external endpoint, and no telemetry. DevAssist can only reach a model that VS
  Code already exposes to you.
- **CI is opt-in and refuses to guess.** The optional pull-request reviewer
  (`ci/`) ships as a deliberate **stub with no default endpoint**. It will not
  send your code anywhere until you explicitly point it at an approved gateway
  (see [CI pull-request review](#ci-pull-request-review)). Until then it does
  nothing but emit a non-blocking warning.

## Commands

Open the file you want to work on, then mention `@devassist` in chat with one of:

| Command     | What it does                                                                 |
| ----------- | --------------------------------------------------------------------------- |
| `/tests`    | Generate Pytest unit tests for the active file (happy path, edge cases, error branches). |
| `/readme`   | Generate a README for the current module/repo from its code and file tree.  |
| `/coverage` | Assess the active file's coverage and suggest concrete testability refactors. |
| `/style`    | Review the active file against the project style guide.                      |
| `/review`   | Run style, coverage, and tests in sequence.                                 |

A bare `@devassist` (or an unknown command) prints this list.

### Style guide

`/style` and the CI reviewer check code against a style guide. DevAssist uses
`style-guide.md` from your workspace root if it exists, and otherwise falls back
to the [bundled standard](style-guide.md) (Python-first, with language-agnostic
rules).

### Coverage

`/coverage` looks for test files related to the active file and, if a Cobertura
`coverage.xml` is present in the workspace, folds its line-coverage numbers into
the prompt so the assessment is grounded in real data.

## Requirements

- VS Code `^1.90.0`
- The **GitHub Copilot** extension, installed and signed in (this is what
  provides the chat model behind `vscode.lm`).

## Install / run from source

```bash
npm install
npm run compile      # or: npm run watch
```

Then press **F5** in VS Code to launch the Extension Development Host, open a
file, and chat with `@devassist`.

## Development

The project is checked by CI on every push and pull request
(`.github/workflows/ci.yml`):

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run format       # Prettier (check only; use format:write to fix)
npm test             # compile, then run the node:test suite in out/test
```

Tests live in `test/` and exercise the pure, host-independent logic — prompt
construction (`src/core/prompts.ts`), Cobertura parsing (`src/core/coverage.ts`),
and the CI diff/review helpers (`ci/lib.ts`). Anything that imports `vscode` is
kept thin so the testable core has no editor dependency.

## CI pull-request review

`.github/workflows/devassist-pr.yml` can run the same style/coverage/tests
prompts on every pull request and post the results as a review. Because
`vscode.lm` does not exist in a GitHub Actions runner, this path needs its own
model access, and it is **intentionally not wired up by default**.

To enable it:

1. Set the repo secrets `DEVASSIST_MODEL_ENDPOINT` and `DEVASSIST_MODEL_TOKEN`
   to point at your organization's approved model gateway.
2. Implement the marked request body in [`ci/CiModelProvider.ts`](ci/CiModelProvider.ts)
   to match that gateway's request/response contract.

Until both are done, the workflow skips with a warning and sends nothing,
by design, so your code is never shipped to an endpoint you didn't choose.

## Project structure

```
src/
  extension.ts          Entry point: registers the @devassist participant, routes commands
  core/
    modelProvider.ts    The model-access seam (VsCodeLmProvider over vscode.lm)
    prompts.ts          Single source of truth for every prompt (pure, no I/O)
    coverage.ts         Pure Cobertura parsing (no vscode, unit-tested)
    context.ts          Turns editor/workspace state into prompt inputs
  handlers/             One handler per slash command (tests, readme, coverage, style)
ci/
  review-pr.ts          Optional GitHub Actions PR reviewer
  lib.ts                Pure CI helpers: language guess, diff parsing, review parsing
  CiModelProvider.ts    CI model seam: a stub you must configure
test/                   node:test unit tests for the pure modules
style-guide.md          The bundled default style guide
```

`prompts.ts` is deliberately dependency-free so both the editor extension and
the CI script share the exact same prompts.

## License

MIT
