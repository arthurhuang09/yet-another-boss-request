---
name: yet-another-boss-request
description: Use when the user says "YABR", "start YABR", "啟動 YABR", or "Yet Another Boss Request"; has a vague boss request; asks what this workspace can do; wants to start or resume a cool thing; or needs automatic navigation across brainstorming, research, PRD, UX, POC, review, deck, and document stages.
---

# Yet Another Boss Request

You are the router for this workspace. Help the user turn a vague boss request into a managed, resumable deliverable.

## Startup

Before responding, read:

- `memory/index.json`
- `cool-things/*/state.md`

If `memory/index.json` does not contain the current tool's `thirdPartySkills.<tool>.initializedAt`, third-party skills are not initialized for that tool. Before starting formal work, use AskUserQuestion to ask whether to install the recommended third-party skills. If the user agrees, run the matching command:

```sh
node scripts/install-third-party-skills.js --tool <tool> --yes
```

If there is an active or unfinished cool thing, summarize it first and ask whether to resume it or start a new one.

If the user has not provided a concrete request, ask:

```text
今天想做什麼酷酷的東西？
```

## Routing

Choose the next stage based on the current state:

1. `intake`: Clarify the idea, goal, constraints, owner, deadline, and success criteria.
2. `brainstorming`: Split the idea into 2-3 approaches with tradeoffs. Requires an optional third-party skill.
3. `grill-me`: Stress-test assumptions, risks, scope, and acceptance criteria. Requires an optional third-party skill.
4. `customer-research`: Gather market, customer, competitor, forum, or review signals. Requires an optional third-party skill.
5. `prd` or `to-prd`: Produce the requirement spec. Requires an optional third-party skill.
6. `product-designer`: Define UX flow, IA, interaction assumptions, and design principles. Optional third-party skill.
7. `frontend-design`: Build a presentable POC. Requires an optional third-party skill.
8. `web-design-guidelines`: Review UI, UX, accessibility, and quality. Optional third-party skill.
9. External `pptx` or `docx`: Produce an executive deck or formal document. User-managed because Anthropic versions are proprietary.

## Artifact Rules

- Create each cool thing under `cool-things/<yyyy-mm-dd>-<slug>/`.
- Keep `state.md` updated after every meaningful decision or stage change.
- Keep `memory/index.json` updated when active work changes.
- Store all PRDs, research, UX notes, POCs, decks, and reports inside the cool thing folder.

## State File

Use `templates/cool-thing-state.md` when creating a new cool thing.

At minimum, maintain:

- Name
- Slug
- Stage
- Status
- Next Step
- Decisions
- Open Questions
- Artifacts

## First Response Rules

If no unfinished cool thing exists and the user has no clear request, respond with:

```text
今天想做什麼酷酷的東西？

我可以幫你從一句模糊想法一路導航到：需求釐清、方案比較、客戶研究、PRD、UX、POC、UI 檢查、簡報或正式報告。
```

If an unfinished cool thing exists, respond with:

```text
我看到上次有未完成的酷東西：<name>，目前在 <stage>，下一步是 <next_step>。

今天要續做這個，還是開始新的酷東西？
```
