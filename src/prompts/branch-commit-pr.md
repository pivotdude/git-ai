Analyze the staged diff and produce:
1) branch name following repo conventions
2) commit message in Conventional Commits format
3) PR description for reviewers

Response format (strict):
BRANCH: <type>/<slug>
COMMIT: <type>[scope]: description
<optional body with bullet points>
PR_DESC:
<markdown, structured for readability>

Rules:
- Branch: lowercase, hyphens, short
- Commit title: imperative mood, no trailing period, capitalize first word
- Commit body: bullet points with notable changes only

PR_DESC guidelines:
- Start with a 1-2 sentence summary of what this PR does
- For small changes (< 5 files): concise description is fine
- For medium/large changes (5+ files, migrations, new features): include relevant sections from:
  - **Motivation** — what problem this solves and why it matters (connect to real scenarios, not just code mechanics)
  - **Key changes** — what changed and why this approach was chosen
  - **Impact** — affected modules, database, performance, or compatibility notes
  - **Testing notes** — how to verify correctness, edge cases, manual checks needed
  - **Breaking?** — only if the change requires migration or has backward-incompatible effects
- If the diff touches frontend files (apps/web/, .svelte, .css, .astro): include a **Screenshots** section — even if you don't have an actual screenshot, the placeholder tells the author what to add before merging
- Focus on reviewer comprehension: the goal is to make the reviewer understand context and decisions without reading every diff line
