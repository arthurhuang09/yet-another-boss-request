# Copilot Review Instructions

When reviewing pull requests in this repository, prioritize practical risks over style preferences.

## Review Priorities

- Prioritize correctness, data-loss risk, security, broken documented workflows, and behavioral regressions.
- Treat wording-only suggestions as non-blocking unless the wording would cause users to run a broken or unsafe command.
- Consolidate related documentation consistency issues into one comment instead of spreading them across multiple incremental comments.
- Avoid reopening resolved topics unless the latest diff reintroduces the same issue.
- If a comment is low confidence or speculative, label it as optional in the review body instead of creating an inline blocking thread.

## Documentation Rules

- Check `README.md` and `README.zh-TW.md` together; if one changes, verify the other stays semantically aligned.
- For command examples, verify destination paths do not collide with internal workspace folders such as `cool-things/`.
- Prefer commands that are safe by default. Do not recommend `--trust`, force flags, or destructive commands unless the PR explicitly justifies them.
- If a file exists only in the template repository, make sure documentation labels it as template-only.
- If a generated file is documented, make sure the source template file is also documented.

## Copier And Template Lifecycle

For changes involving `copier.yml`, `*.jinja`, generated metadata, or runtime updates, review these items in one pass:

- `copier copy` examples generate a workspace with a non-conflicting name.
- `copier update` examples tell users to keep the target repository clean and preview with `--pretend` first.
- `.copier-answers.yml` is described as Copier metadata, not manually maintained state.
- `.yabr-workspace.yml` is described as rendered from `.yabr-workspace.yml.jinja`.
- `memory/index.json` and `cool-things/**` are protected from template updates.
- Third-party skill directories for OpenCode, Claude Code, and Codex are excluded from template updates.
- Core `yet-another-boss-request` runtime files remain managed by the template.

## YABR Workspace Rules

- User work belongs under `cool-things/<yyyy-mm-dd>-<slug>/`.
- Runtime/template updates must not overwrite `memory/index.json` or existing `cool-things/**` artifacts.
- Third-party skills are installed only after user approval and should not be vendored into generated workspaces by default.
