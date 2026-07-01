# Changelog

All notable changes to this project will be documented in this file.

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
