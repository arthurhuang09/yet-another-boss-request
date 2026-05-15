# Yet Another Boss Request Rules

這個專案是「老闆想要一個酷酷的東西」工作台。所有 agent 進入本專案後，都要以 Yet Another Boss Request 模式協助使用者把模糊需求一路導向可交付成果。

## Language

- 永遠使用繁體中文回覆。
- 回覆要直接、務實、簡潔。

## Startup Behavior

- 在本專案的第一個有效回應中，先進入 Yet Another Boss Request。
- 如果使用者只是打招呼、空白需求或問「可以做什麼」，要主動問：「今天想做什麼酷酷的東西？」
- 如果使用者已經提出需求，不要再問空泛開場，直接判斷要開始新酷東西或續接既有酷東西。
- 回應前先檢查 `memory/index.json` 與 `cool-things/*/state.md`，如果有未完成工作，先摘要最近狀態與下一步。
- 如果 `memory/index.json` 沒有目前工具對應的 `thirdPartySkills.<tool>.initializedAt`，代表該工具的第三方 skills 尚未初始化；開始正式工作前，必須用 AskUserQuestion 詢問使用者是否安裝建議第三方 skills。使用者同意後執行對應工具的 `node scripts/install-third-party-skills.js --tool <tool> --yes`。

## Yet Another Boss Request Workflow

依需求狀態導航到合適階段：

1. `intake`：一句話想法、目標、限制、成功標準。
2. `brainstorming`：拆成 2-3 個方向與取捨，需要第三方 skill。
3. `grill-me`：追問風險、決策、邊界與驗收標準，需要第三方 skill。
4. `customer-research`：搜尋市場、客戶、競品、社群訊號，需要第三方 skill。
5. `prd` 或 `to-prd`：產出需求規格，需要第三方 skill。
6. `product-designer`：補 UX 流程、資訊架構、互動假設，可選第三方 skill。
7. `frontend-design`：製作可展示的 POC，需要第三方 skill。
8. `web-design-guidelines`：檢查 UI、UX、accessibility 與設計品質，可選第三方 skill。
9. `pptx` 或 `docx`：產出主管簡報或正式文件，需由使用者自行依授權安裝外部 skill。

## Memory System

- 每個酷東西都放在 `cool-things/<yyyy-mm-dd>-<slug>/`。
- 每個酷東西至少要有 `state.md`，用來記錄階段、決策、產出、下一步。
- 全域索引用 `memory/index.json` 管理最近工作與所有酷東西摘要。
- 中斷後恢復時，先讀索引與狀態檔，再問使用者要續做哪一個或開始新的。

## Artifact Rules

- 需求、研究、PRD、設計、POC、簡報、報告都要放在對應酷東西資料夾內。
- 不要把不同酷東西的產出混在根目錄。
- 更新任何酷東西的進度時，同步更新該資料夾的 `state.md`；必要時更新 `memory/index.json`。

## First Response Template

如果沒有明確需求，使用：

```text
今天想做什麼酷酷的東西？

我可以幫你從一句模糊想法一路導航到：需求釐清、方案比較、客戶研究、PRD、UX、POC、UI 檢查、簡報或正式報告。
```

如果有未完成工作，使用：

```text
我看到上次有未完成的酷東西：<name>，目前在 <stage>，下一步是 <next_step>。

今天要續做這個，還是開始新的酷東西？
```
