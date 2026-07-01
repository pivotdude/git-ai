# git-ai

AI-assisted git workflows: commit messages, branches, pull requests, and optional pre-commit fixes.

Requires [Bun](https://bun.sh) >= 1.3 and `git` / `gh` on `PATH` for the full workflow.

## Install

```bash
npm i -g git-ai
# or
bun add -g git-ai
```

Run from any directory inside a git repository:

```bash
git-ai
git-ai --mode commit-push
git-ai --provider manual
```

Monorepos can wire package scripts, e.g. `"git:ai": "git-ai"`.

## Project config (`.git-ai/`)

Optional files at the **git repository root**:

| Path | Purpose |
|------|---------|
| `.git-ai/config.json` | `baseBranch`, `stagedFix`, optional `conventions` / `prTemplate` paths ([JSON Schema](config.schema.json)) |
| `.git-ai/diff-ignore` | `.gitignore`-style patterns omitted from AI diffs (merged with built-in lockfile defaults) |
| `.git-ai/prompts/*.md` | Per-mode prompt overrides (`commit-push.md`, `create-pr.md`, …) |
| `.git-ai/conventions.md` | Commit/branch conventions when `conventions` is not set in `config.json` |

See `project-config.example/` for a starter layout.

Legacy `.git-ai.json` at the repo root is still read if `config.json` is missing.

Point `$schema` in `config.json` at the published schema URL for editor autocomplete:

```json
{
  "$schema": "https://raw.githubusercontent.com/pivotdude/git-ai/main/config.schema.json"
}
```

## Dry run

Print the assembled AI prompt without calling an API or running git actions:

```bash
git-ai --dry-run --mode commit-push
git-ai -n --mode create-pr
```

Git state is still read (staged diff, branch log, etc.) to build the prompt.

## `stagedFix` and shell commands

`stagedFix` in `config.json` runs **arbitrary shell commands** from the repository root before commit (for example `bun --filter web fix`).

- Only add commands you trust, in repositories you control.
- Anyone who can change `.git-ai/config.json` can run shell code on your machine when you approve a git-ai commit.
- Commands are executed with `sh -c`; failures are warned but do not always stop the workflow.

Treat `.git-ai/` like other sensitive local tooling config (similar to custom git hooks).

## AI providers

| Provider | Env vars |
|----------|----------|
| OpenAI-compatible | `OPENAI_BASE_URL`, `OPENAI_API_KEY`, optional `OPENAI_MODEL` |
| Cursor SDK | `CURSOR_API_KEY`, optional `CURSOR_MODEL` |
| Manual | Copies prompt to clipboard / `$EDITOR`; no API key |

Before applying, you can **edit** individual fields (branch, commit message, PR title, description) in `$EDITOR`.

Uses `$VISUAL` or `$EDITOR` (default `nano`) for manual provider responses and pre-apply edits.

When the API returns token usage (OpenAI-compatible providers), git-ai prints a one-line `[tokens]` summary with in/out/total counts. Cost is shown only when included in the response (e.g. some OpenRouter payloads).

## Development

```bash
bun install
bun run check      # typecheck
bun run lint:check
bun test           # unit tests
bun run build
```

Suggested validation before opening a PR or publishing:

```bash
bun run validate:local-release
```

## npm release flow

1. Bump `package.json.version`.
2. Commit and push to GitHub.
3. Create and push tag `v<version>` (for example `v1.0.1`).
4. Publish a GitHub Release from that tag.
5. GitHub Actions publishes the package to npm with the `latest` tag (`NPM_TOKEN` secret required).

## License

MIT
