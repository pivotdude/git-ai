# Git Conventions

This file defines the preferred branch naming and commit message format for this repository.

Use it for human work and agent-generated git output.

## Branch Naming

Use lowercase, short, descriptive names.

Preferred format:

```text
<type>/<short-kebab-slug>
```

Examples:

- `feature/chart-toolbar`
- `bugfix/ws-reconnect`
- `refactor/backend-health-module`
- `docs/update-readme`
- `test/profile-page`
- `chore/deps-refresh`

## Allowed Branch Types

- `feature` - new functionality
- `bugfix` - bug fixes
- `hotfix` - urgent production fix
- `docs` - documentation changes
- `refactor` - structural code changes without intended behavior change
- `test` - tests or test infrastructure
- `chore` - maintenance, tooling, or cleanup

## Branch Rules

- use lowercase only;
- use hyphens inside the slug;
- keep names short and readable;
- avoid spaces, camelCase, snake_case, dots, and repeated hyphens.

## Commit Format

Use Conventional Commit style:

```text
<type>[<scope>]: <description>
```

Examples:

- `feat(chart): add timeframe switcher`
- `fix(auth): handle expired session redirect`
- `docs(readme): update workspace guidance`
- `refactor(websocket): simplify subscription cleanup`

## Allowed Commit Types

- `feat`
- `fix`
- `docs`
- `refactor`
- `test`
- `chore`
- `perf`
- `style`
- `build`
- `ci`

## Commit Rules

- use imperative mood;
- capitalize the first word of the description;
- do not end the title with a period;
- keep the title concise;
- keep the scope short and meaningful when used.

## Commit Body

If a body is needed, use flat markdown bullets:

```text
<type>[<scope>]: <description>

- Change 1
- Change 2
- Change 3
```

Use the body for:

- notable implementation details;
- affected areas;
- important migration or compatibility notes.

## What To Avoid

- vague branch names like `fixes` or `update-stuff`
- commit titles without a type prefix
- long narrative paragraphs in commit bodies
- mixing unrelated changes in one commit
