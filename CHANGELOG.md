# Changelog

All notable changes to this project will be documented in this file.

## [1.0.6] - 2026-07-18

### Added

- `--yes` / `-y` flag to skip yes/no confirmations and apply the AI draft automatically (including cached draft reuse and manual provider copy step).

## [1.0.5] - 2026-07-08

### Fixed

- String `cost` fields from providers (e.g. Manifest `"cost": "0"`) are coerced before token summary formatting (`cost.toFixed is not a function`).

## [1.0.4] - 2026-07-08

### Added

- `.git-ai/config.json` `ai.maxTokens` and `ai.maxTokensByMode` to override completion limits per repo/mode.
- `.git-ai/config.json` `ai.reasoning` (`off` | `on` | `low` | `medium` | `high`) and optional `ai.reasoningProfile` (`openai` | `openrouter` | `deepseek` | `compatible`). Profile auto-detects from `OPENAI_BASE_URL` host; unknown hosts use `compatible` (OpenRouter + DeepSeek request fields).

### Changed

- Default `max_tokens` for commit modes (`commit-push`, `branch-commit-push`) raised from 500 to 2048.

### Fixed

- OpenAI-compatible providers that return reasoning in `reasoning_content` now auto-retry with a higher token limit when the final `content` is empty due to `finish_reason: length`.
- Clear error when reasoning models exhaust the token budget without producing final content.

## [1.0.3] - 2026-07-01

### Fixed

- Republish to refresh npm registry metadata for package managers.

## [1.0.2] - 2026-07-01

### Fixed

- CLI entrypoint now calls `run()` from `bin/git-ai.js` (import-only build exited silently).

## [1.0.1] - 2026-07-01

### Changed

- Publish as unscoped `pivotdude-git-ai` on npm (scoped `@pivotdude/git-ai` was private and not installable).

## [1.0.0] - 2026-07-01

### Added

- Initial public release extracted from the OpenTrade monorepo.
- AI-assisted git workflows: commit-push, branch-commit-pr, create-pr, update-pr.
- Project config via `.git-ai/` directory.
- OpenAI-compatible, Cursor SDK, and manual AI providers.
