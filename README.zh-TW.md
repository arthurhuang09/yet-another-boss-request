# Yet Another Boss Request

![Yet Another Boss Request 橫幅](assets/yabr-banner.png)

[English](README.md) | 繁體中文

Yet Another Boss Request 是一個用來處理「老闆想要一個酷酷的東西」這類模糊需求的 agent 工作台。它會把一句不完整的想法導向可交付成果，例如需求釐清、方案比較、客戶研究、PRD、UX、POC、UI 檢查、簡報或正式報告。

## 功能

1. 進入專案後，OpenCode、Claude Code、Codex 會透過各自的 hook/adapter 載入同一份導航規則與記憶狀態。
2. 如果你只是打招呼，agent 會主動問：「今天想做什麼酷酷的東西？」
3. 如果你直接提出需求，agent 會建立或續接一個酷東西工作流。
4. 如果之前被中斷，agent 會讀取 `memory/index.json` 與 `cool-things/*/state.md`，先摘要目前進度與下一步。

## 支援工具

| Tool | Status | Notes |
| --- | --- | --- |
| OpenCode | Tested | 使用 `.opencode/plugins/yet-another-boss-request.js` 自動送出 `start YABR` 啟動 prompt |
| Claude Code | Configured | 使用 `.claude/settings.json` 的 `SessionStart` hook |
| Codex | Configured | 使用 `.codex/hooks.json` 與 `.codex/config.toml` |

## 平台說明

| Platform | 設定檔 | 啟動方式 | 行為 |
| --- | --- | --- | --- |
| Claude Code | `.claude/settings.json`、`.claude/skills/` | 從專案根目錄啟動 Claude Code | `SessionStart` 時注入 Yet Another Boss Request context |
| Codex | `.codex/hooks.json`、`.codex/config.toml`、`.codex/skills/` | 從專案根目錄啟動 Codex | `SessionStart` 時注入 Yet Another Boss Request context |
| OpenCode | `opencode.json`、`.opencode/plugins/`、`.agents/skills/` | 執行 `opencode .` | 載入 project skills，並自動送出 `start YABR` 啟動 prompt |

Claude Code 與 Codex 的 hook 主要負責注入 context；OpenCode 額外提供 autostart，會建立 session 並送出啟動 prompt。Codex hook 目前使用 `git rev-parse --show-toplevel` 尋找專案根目錄，因此需要在 Git repo 內執行。

## 快速開始

在專案根目錄啟動你使用的 agent 工具，然後輸入：

```text
今天想做一個酷酷的東西
```

或直接輸入需求：

```text
老闆想做一個 AI 客服入口，幫我從需求釐清一路規劃到可以展示的 POC。
```

若要續接中斷的工作，可以輸入：

```text
幫我續做上次的酷東西
```

## OpenCode 使用方式

`opencode.json` 已設定 `skills.paths` 指向 `.agents/skills`。請從此專案根目錄啟動 OpenCode：

```sh
opencode .
```

OpenCode adapter 會在新 session 建立後自動送出：

```text
start YABR
Read YABR memory and run the startup check.
If third-party skills are missing, immediately ask via AskUserQuestion whether to install them.
```

若要暫時關閉自動啟動：

```sh
OPENCODE_YABR_AUTOSTART=0 opencode .
```

OpenCode plugin 依賴 `@opencode-ai/sdk`。如果 fresh clone 後 plugin 無法載入，請安裝 `.opencode` 內的依賴：

```sh
npm install --prefix .opencode
```

目前測試版本：OpenCode `1.14.51`。

## 目錄結構

| Path | 用途 |
| --- | --- |
| `AGENTS.md` | 跨工具共用的 Yet Another Boss Request 行為規則 |
| `copier.yml` | Template repo only：Copier lifecycle 與更新設定 |
| `{{ _copier_conf.answers_file }}.jinja` | Template repo only：Copier answers metadata template |
| `.yabr-workspace.yml.jinja` | Template repo only：YABR workspace metadata template |
| `scripts/yet-another-boss-request-hook.js` | OpenCode、Claude Code、Codex 共用的導航 context 產生器 |
| `scripts/install-third-party-skills.js` | Optional third-party skill 安裝器 |
| `third-party-skills.json` | 第三方 skill 安裝清單 |
| `THIRD_PARTY_SKILLS.md` | 第三方 skill 授權與安裝說明 |
| `.copier-answers.yml` | scaffolded workspace 內由 Copier 產生的 metadata |
| `.yabr-workspace.yml` | scaffolded workspace 內由 Copier render 的 YABR workspace metadata |
| `.agents/skills/` | OpenCode project skills |
| `.claude/settings.json` | Claude Code `SessionStart` hook |
| `.claude/skills/` | Claude Code skills |
| `.codex/hooks.json` | Codex `SessionStart` hook |
| `.codex/config.toml` | Codex hooks feature 設定 |
| `.codex/skills/yet-another-boss-request/SKILL.md` | Codex 可用的 Yet Another Boss Request skill |
| `.opencode/plugins/yet-another-boss-request.js` | OpenCode plugin adapter |
| `memory/index.json` | 全域記憶索引與目前 active 酷東西 |
| `cool-things/` | 每次酷東西的獨立工作資料夾 |
| `templates/cool-thing-state.md` | 每個酷東西的狀態檔模板 |

## 平台支援

YABR 目前主要測試於 macOS 與 Linux-like 環境。Windows 使用者目前建議透過 WSL 執行；原生 Windows 尚未正式測試，因為文件中的 setup 與 adoption 指令使用 `mktemp`、`cp`、`sh` 等 POSIX shell 工具。

## Runtime 更新

從此 repository 建立出來的 workspace，應該把 YABR runtime 檔案和自己的 memory / artifacts 分開處理。YABR 使用 [Copier](https://copier.readthedocs.io/) 管理 template lifecycle update，不再維護自製 updater。

建議用 `pipx` 安裝 Copier，讓它成為可直接使用的 CLI，同時不修改系統 Python：

```sh
brew install pipx
pipx install copier
```

如果只是臨時測試，可以改用 virtual environment：

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install copier
```

除非你本來就刻意用全域 pip 管理 Python CLI 工具，否則不建議使用全域 `python3 -m pip install copier`。

從 template 建立新 workspace：

```sh
copier copy gh:arthurhuang09/yet-another-boss-request ../yabr-workspace
```

當 YABR 發布新 tag 後，更新既有 Copier-managed workspace：

```sh
cd ../yabr-workspace
copier update --pretend
copier update
```

請從 workspace root 執行更新。Copier 會使用 `.copier-answers.yml` 找到原始 template，並更新到最新 tag。更新前請保持 workspace clean；`copier update --pretend` 只預覽、不寫檔。正式套用後，檢查 `git diff`、跑平常的驗證，再在 workspace repository commit 這次 runtime update。

Copier 會在 scaffolded workspace 寫入 `.copier-answers.yml`，用來追蹤 template source 與 revision，並從 `.yabr-workspace.yml.jinja` render `.yabr-workspace.yml` 作為輕量 workspace metadata。`copier.yml` 對 `memory/index.json` 與 `cool-things/**` 使用 `_skip_if_exists`，避免 template update 取代本地工作。第三方 skill 目錄會從 template 排除；核心 `yet-another-boss-request` skills 仍由 Copier 管理。`copier.yml` 只保留在 template repository，不會複製到 generated workspace。

如果既有 workspace 是在導入 Copier 前直接複製建立，請先採用 Copier metadata：

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

確認 pretend update 看起來正確後，再執行 `copier update`。更新前請保持 target repository clean，讓 Copier 能清楚顯示衝突。

## 工作流

1. `intake`：一句話想法、目標、限制、成功標準。
2. `brainstorming`：拆成 2-3 個方向與取捨，需要 optional third-party skill。
3. `grill-me`：追問風險、決策、邊界與驗收標準，需要 optional third-party skill。
4. `customer-research`：搜尋市場、客戶、競品、社群訊號，需要 optional third-party skill。
5. `prd` 或 `to-prd`：產出需求規格，需要 optional third-party skill。
6. `product-designer`：補 UX 流程、資訊架構、互動假設，屬於 optional third-party skill。
7. `frontend-design`：製作可展示的 POC，需要 optional third-party skill。
8. `web-design-guidelines`：檢查 UI、UX、accessibility 與設計品質，屬於 optional third-party skill。
9. Optional external `pptx` 或 `docx` skills：產出主管簡報或正式文件。

## 記憶系統

每個酷東西都應該建立在：

```text
cool-things/<yyyy-mm-dd>-<slug>/
```

每個資料夾至少包含：

```text
state.md
```

建議產出結構：

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

`memory/index.json` 用來記錄目前 active 的酷東西、最近工作與索引摘要。每次階段改變時，應同步更新該酷東西的 `state.md`，必要時更新 `memory/index.json`。

## 核心 Skill

| Skill | 用途 |
| --- | --- |
| `yet-another-boss-request` | 自動判斷階段、續接記憶、導向合適 skill |

## Third-Party Skill 安裝流程

這個 repo 預設不 vendored 第三方 skills。首次啟動時，Yet Another Boss Request 會依目前工具檢查 `memory/index.json`。如果沒有 `thirdPartySkills.<tool>.initializedAt`，它會先詢問是否為該工具安裝建議第三方 skills。

手動為單一工具安裝預設建議組合：

```sh
node scripts/install-third-party-skills.js --tool opencode --yes
node scripts/install-third-party-skills.js --tool claude-code --yes
node scripts/install-third-party-skills.js --tool codex --yes
```

列出所有可選第三方 skills：

```sh
node scripts/install-third-party-skills.js --list
```

安裝完成後，安裝器會在 `memory/index.json` 寫入 `thirdPartySkills.<tool>.initializedAt`。授權細節與 optional restricted skills 請看 `THIRD_PARTY_SKILLS.md`。

## Optional External Skills

`pptx` 與 `docx` 不會由這個 repo 安裝，因為 Anthropic 提供的版本是 proprietary，且限制再散布。如果你透過 Anthropic services 擁有這些 skills 的使用權，請自行安裝並遵守原始授權條款。

## 開源注意事項

第三方 skills 來自不同來源，且只會在使用者同意後依 `third-party-skills.json` 安裝。若你要重新發布或打包已安裝的 skills，請先檢查 `THIRD_PARTY_SKILLS.md` 與各來源授權。本 repo 刻意不包含 proprietary Anthropic `docx` 與 `pptx` skills。

## License

本專案以 MIT License 授權。第三方 skills 與其附帶檔案仍依各自來源授權為準。
