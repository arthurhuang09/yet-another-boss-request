# Yet Another Boss Request

English | [繁體中文](README.zh-TW.md)

Yet Another Boss Request is an agent workspace for handling vague requests like "the boss wants something cool." It helps turn an incomplete idea into concrete deliverables such as clarification questions, option comparison, customer research, PRDs, UX plans, POCs, UI reviews, slide decks, or formal documents.

## Features

1. OpenCode, Claude Code, and Codex can load the same routing rules and memory state through their own hooks/adapters.
2. If you only say hello, the agent asks: "What boss-level nonsense are we shipping today?"
3. If you provide a request directly, the agent starts or resumes a managed "cool thing" workflow.
4. If previous work was interrupted, the agent reads `memory/index.json` and `cool-things/*/state.md`, then summarizes the current status and next step.

## Supported Tools

| Tool | Status | Notes |
| --- | --- | --- |
| OpenCode | Tested | Uses `.opencode/plugins/yet-another-boss-request.js` to send the `start YABR` startup prompt automatically |
| Claude Code | Configured | Uses the `SessionStart` hook in `.claude/settings.json` |
| Codex | Configured | Uses `.codex/hooks.json` and `.codex/config.toml` |

## Platform Notes

| Platform | Config Files | Startup | Behavior |
| --- | --- | --- | --- |
| Claude Code | `.claude/settings.json`, `.claude/skills/` | Start Claude Code from the project root | Injects Yet Another Boss Request context on `SessionStart` |
| Codex | `.codex/hooks.json`, `.codex/config.toml`, `.codex/skills/` | Start Codex from the project root | Injects Yet Another Boss Request context on `SessionStart` |
| OpenCode | `opencode.json`, `.opencode/plugins/`, `.agents/skills/` | Run `opencode .` | Loads project skills and automatically sends the `start YABR` startup prompt |

Claude Code and Codex hooks mainly inject context. OpenCode additionally provides autostart by creating a session and sending the startup prompt. The Codex hook currently uses `git rev-parse --show-toplevel` to find the project root, so it should be run inside a Git repository.

## Quick Start

Start your agent tool from the project root, then type:

```text
Let's ship some boss-level nonsense.
```

Or provide a request directly:

```text
The boss wants an AI customer support portal. Help me clarify the requirements and turn it into a demo-ready POC.
```

To resume interrupted work, type:

```text
Resume the last boss-level thing.
```

## OpenCode Usage

`opencode.json` points `skills.paths` to `.agents/skills`. Start OpenCode from this project root:

```sh
opencode .
```

The OpenCode adapter automatically sends this prompt when a new session starts:

```text
start YABR
Read YABR memory and run the startup check.
If third-party skills are missing, immediately ask via AskUserQuestion whether to install them.
```

To temporarily disable autostart:

```sh
OPENCODE_YABR_AUTOSTART=0 opencode .
```

The OpenCode plugin depends on `@opencode-ai/sdk`. If the plugin does not load after a fresh clone, install dependencies inside `.opencode`:

```sh
npm install --prefix .opencode
```

Tested with OpenCode `1.14.51`.

## Project Layout

| Path | Purpose |
| --- | --- |
| `AGENTS.md` | Shared Yet Another Boss Request behavior rules |
| `copier.yml` | Template repo only: Copier lifecycle and update configuration |
| `{{ _copier_conf.answers_file }}.jinja` | Template repo only: Copier answers metadata template |
| `.yabr-workspace.yml.jinja` | Template repo only: YABR workspace metadata template |
| `scripts/yet-another-boss-request-hook.js` | Shared context generator for OpenCode, Claude Code, and Codex |
| `scripts/install-third-party-skills.js` | Optional third-party skill installer |
| `third-party-skills.json` | Third-party skill install manifest |
| `THIRD_PARTY_SKILLS.md` | Third-party skill license and install notes |
| `.copier-answers.yml` | Generated Copier metadata in scaffolded workspaces |
| `.yabr-workspace.yml` | Copier-rendered YABR workspace metadata in scaffolded workspaces |
| `.agents/skills/` | OpenCode project skills |
| `.claude/settings.json` | Claude Code `SessionStart` hook |
| `.claude/skills/` | Claude Code skills |
| `.codex/hooks.json` | Codex `SessionStart` hook |
| `.codex/config.toml` | Codex hooks feature config |
| `.codex/skills/yet-another-boss-request/SKILL.md` | Yet Another Boss Request skill for Codex |
| `.opencode/plugins/yet-another-boss-request.js` | OpenCode plugin adapter |
| `memory/index.json` | Global memory index and active cool thing pointer |
| `cool-things/` | Per-request working folders |
| `templates/cool-thing-state.md` | Template for each cool thing state file |

## Platform Support

YABR is currently tested on macOS and Linux-like environments. Windows users should use WSL for now. Native Windows support is not yet tested because the documented setup and adoption commands use POSIX shell utilities such as `mktemp`, `cp`, and `sh`.

## Runtime Updates

Workspaces created from this repository should treat YABR runtime files separately from their own memory and artifacts. YABR uses [Copier](https://copier.readthedocs.io/) for template lifecycle updates instead of a custom updater.

Install Copier with `pipx` so it is available as a CLI without modifying your system Python:

```sh
brew install pipx
pipx install copier
```

For a temporary test environment, use a virtual environment instead:

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install copier
```

Avoid global `python3 -m pip install copier` unless you intentionally manage Python CLI tools that way.

Create a new workspace from this template:

```sh
copier copy gh:arthurhuang09/yet-another-boss-request ../yabr-workspace
```

Update an existing Copier-managed workspace:

```sh
cd ../yabr-workspace
git status --short
copier update --pretend
copier update
git diff
```

Commit or stash local changes before updating. `copier update --pretend` previews the update without writing files. After applying the update, inspect `git diff`, run your normal checks, then commit the runtime update in the workspace repository.

Copier writes `.copier-answers.yml` in scaffolded workspaces to track the template source and revision, and renders `.yabr-workspace.yml` from `.yabr-workspace.yml.jinja` with lightweight workspace metadata. `copier.yml` uses `_skip_if_exists` for `memory/index.json` and `cool-things/**` so local work is not replaced by template updates. Third-party skill directories are excluded from the template; the core `yet-another-boss-request` skills remain managed by Copier. `copier.yml` itself stays in the template repository and is not copied into generated workspaces.

For an existing workspace that was copied before Copier was introduced, adopt Copier metadata first:

```sh
cd ../yabr-workspace
git status --short
tmpdir="$(mktemp -d)"
workspace_name="$(basename "$PWD")"
copier copy --defaults --data "workspace_name=$workspace_name" gh:arthurhuang09/yet-another-boss-request "$tmpdir/$workspace_name"
cp "$tmpdir/$workspace_name/.copier-answers.yml" .
cp "$tmpdir/$workspace_name/.yabr-workspace.yml" .
git add .copier-answers.yml .yabr-workspace.yml
git commit -m "Adopt YABR Copier metadata"
copier update --pretend
```

Only run `copier update` after the pretend update looks correct. Keep the target repository clean before updating so Copier can surface conflicts clearly.

## Workflow

1. `intake`: Clarify the idea, goal, constraints, and success criteria.
2. `brainstorming`: Split the idea into 2-3 directions with tradeoffs. Requires an optional third-party skill.
3. `grill-me`: Stress-test risks, decisions, boundaries, and acceptance criteria. Requires an optional third-party skill.
4. `customer-research`: Search market, customer, competitor, and community signals. Requires an optional third-party skill.
5. `prd` or `to-prd`: Produce the requirement spec. Requires an optional third-party skill.
6. `product-designer`: Add UX flows, information architecture, and interaction assumptions. Optional third-party skill.
7. `frontend-design`: Build a presentable POC. Requires an optional third-party skill.
8. `web-design-guidelines`: Review UI, UX, accessibility, and design quality. Optional third-party skill.
9. Optional external `pptx` or `docx` skills: Produce an executive deck or formal document.

## Memory System

Each cool thing should live under:

```text
cool-things/<yyyy-mm-dd>-<slug>/
```

Each folder should include at least:

```text
state.md
```

Suggested artifact layout:

```text
cool-things/2026-05-15-ai-customer-service/
state.md
brief.md
research.md
prd.md
ux.md
poc/
deck.md
report.md
```

`memory/index.json` tracks the active cool thing, recent work, and summaries. Whenever the workflow stage changes, update the corresponding `state.md`; update `memory/index.json` when needed.

## Core Skill

| Skill | Purpose |
| --- | --- |
| `yet-another-boss-request` | Route stages, resume memory, and select the right skill |

## Third-Party Skill Setup

This repository does not vendor third-party skills by default. On first startup, Yet Another Boss Request checks `memory/index.json` for the current tool. If `thirdPartySkills.<tool>.initializedAt` is missing, it asks whether you want to install the recommended third-party skills for that tool.

To install the default recommended set manually for one tool:

```sh
node scripts/install-third-party-skills.js --tool opencode --yes
node scripts/install-third-party-skills.js --tool claude-code --yes
node scripts/install-third-party-skills.js --tool codex --yes
```

To list all available third-party skills:

```sh
node scripts/install-third-party-skills.js --list
```

The installer writes `memory/index.json` with `thirdPartySkills.<tool>.initializedAt` after installation. See `THIRD_PARTY_SKILLS.md` for license details and optional restricted skills.

## Optional External Skills

`pptx` and `docx` are not installed by this repository because the Anthropic-provided versions are proprietary and restrict redistribution. If you have access to those skills through Anthropic services, install them separately and follow their original license terms.

## Open Source Notes

Third-party skills come from multiple sources and are installed from `third-party-skills.json` only after user approval. Check `THIRD_PARTY_SKILLS.md` and each source license before redistributing or packaging installed skills. This repository intentionally does not include proprietary Anthropic `docx` and `pptx` skills.

## License

This project is licensed under the MIT License. Third-party skills and bundled files remain governed by their original licenses.
