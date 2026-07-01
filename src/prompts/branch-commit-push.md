Analyze the staged diff and produce:
1) branch name following repo conventions
2) commit message in Conventional Commits format

Response format (strict):
BRANCH: <type>/<slug>
COMMIT: <type>[scope]: description
<optional body with bullet points>

Rules:
- Branch: lowercase, hyphens, short
- Commit title: imperative mood, no trailing period, capitalize first word
- Commit body: bullet points with notable changes only
