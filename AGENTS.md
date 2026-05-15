# Yet Another Boss Request Rules

This project is a workspace for turning "the boss wants something cool" into a concrete deliverable. Every agent working in this project must use Yet Another Boss Request mode to guide vague requests into shippable artifacts.

## Startup Behavior

- In the first effective response for this project, enter Yet Another Boss Request mode.
- If the user only greets, gives an empty request, or asks what this workspace can do, ask: `今天想做什麼酷酷的東西？`
- If the user already provided a concrete request, do not ask a generic opening question; decide whether to start a new cool thing or resume an existing one.
- `YABR memory` means `memory/index.json` and `cool-things/*/state.md`.
- `third-party skills` means the current tool's `thirdPartySkills.<tool>.initializedAt` entry in `memory/index.json`.
- Before responding, inspect YABR memory. If there is unfinished work, summarize the latest status and next step first.
- If `memory/index.json` does not contain the current tool's `thirdPartySkills.<tool>.initializedAt`, third-party skills are not initialized for this tool. Before starting formal work, use AskUserQuestion to ask whether to install the recommended third-party skills. If the user agrees, run `node scripts/install-third-party-skills.js --tool <tool> --yes` for the current tool.

## Yet Another Boss Request Workflow

Route the request to the appropriate stage:

1. `intake`: Clarify the one-line idea, goal, constraints, and success criteria.
2. `brainstorming`: Split the idea into 2-3 directions with tradeoffs. Requires a third-party skill.
3. `grill-me`: Challenge risks, decisions, boundaries, and acceptance criteria. Requires a third-party skill.
4. `customer-research`: Research market, customer, competitor, and community signals. Requires a third-party skill.
5. `prd` or `to-prd`: Produce the requirement spec. Requires a third-party skill.
6. `product-designer`: Define UX flow, information architecture, and interaction assumptions. Third-party skill is optional.
7. `frontend-design`: Build a presentable POC. Requires a third-party skill.
8. `web-design-guidelines`: Review UI, UX, accessibility, and design quality. Third-party skill is optional.
9. `pptx` or `docx`: Produce an executive deck or formal document. The user must install external skills manually according to their licenses.

## Memory System

- Store each cool thing under `cool-things/<yyyy-mm-dd>-<slug>/` with a `state.md` recording stage, decisions, artifacts, and next step.
- Use `memory/index.json` as the global index for recent work and cool thing summaries.
- When resuming, read YABR memory first, then ask whether to resume an existing cool thing or start a new one.

## Artifact Rules

- Store all requirements, research, PRDs, designs, POCs, decks, and reports inside the matching cool thing folder, never in the repository root.
- When updating progress for any cool thing, update that folder's `state.md`; update `memory/index.json` when needed.

## First Response

Use the user's preferred language for first responses.

- No concrete request: ask what cool thing they want to build today, then mention the workspace can guide intake, brainstorming, research, PRD, UX, POC, UI review, decks, and documents.
- Unfinished work: summarize `<name>`, `<stage>`, and `<next_step>`, then ask whether to resume it or start a new cool thing.
