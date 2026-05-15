#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

function findProjectRoot(start) {
  let current = path.resolve(start || process.cwd())
  while (true) {
    if (
      fs.existsSync(path.join(current, "opencode.json")) ||
      fs.existsSync(path.join(current, "third-party-skills.json")) ||
      fs.existsSync(path.join(current, ".git"))
    ) {
      return current
    }

    const parent = path.dirname(current)
    if (parent === current) return path.resolve(start || process.cwd())
    current = parent
  }
}

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8")
  } catch {
    return ""
  }
}

function parseJson(value) {
  if (!value.trim()) return {}
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

function safeReadJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch {
    return fallback
  }
}

function safeReadText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8")
  } catch {
    return ""
  }
}

function listCoolThings(root) {
  const dir = path.join(root, "cool-things")
  if (!fs.existsSync(dir)) return []

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const slug = entry.name
      const statePath = path.join(dir, slug, "state.md")
      const state = safeReadText(statePath)
      return { slug, statePath, state }
    })
}

function extractField(markdown, label) {
  const pattern = new RegExp(`^- \\*\\*${label}:\\*\\*\\s*(.+)$`, "mi")
  const match = markdown.match(pattern)
  return match ? match[1].trim() : ""
}

function summarizeCoolThing(item) {
  return {
    slug: item.slug,
    name: extractField(item.state, "Name") || item.slug,
    stage: extractField(item.state, "Stage") || "unknown",
    status: extractField(item.state, "Status") || "unknown",
    nextStep: extractField(item.state, "Next Step") || "尚未記錄",
  }
}

function buildContext(root) {
  const indexPath = path.join(root, "memory", "index.json")
  const index = safeReadJson(indexPath, {})
  const thirdPartySkillsInitialized = Boolean(index.thirdPartySkills?.initializedAt)
  const coolThings = listCoolThings(root).map(summarizeCoolThing)
  const activeSlug = index.activeCoolThing || index.recentCoolThings?.[0]
  const active = coolThings.find((item) => item.slug === activeSlug) || coolThings[0]

  const lines = []
  lines.push("Yet Another Boss Request 啟動提醒：")
  lines.push("- 本專案是用來處理『老闆想要一個酷酷的東西』的工作台。")
  lines.push("- 第一個有效回應請主動進入 Yet Another Boss Request 模式。")
  lines.push("- 若使用者只是打招呼或沒有明確需求，請問：今天想做什麼酷酷的東西？")
  lines.push("- 若使用者已提出需求，請直接建立或續接對應的酷東西工作流。")
  lines.push("- 產出請放在 cool-things/<yyyy-mm-dd>-<slug>/，狀態寫入 state.md，索引寫入 memory/index.json。")

  if (!thirdPartySkillsInitialized) {
    lines.push("")
    lines.push("第三方 skills 尚未初始化：")
    lines.push("- 目前 repo 只內建 Yet Another Boss Request 核心 skill。")
    lines.push("- 若使用者要開始正式工作，請先詢問是否安裝建議第三方 skills。")
    lines.push("- 若使用者同意，執行：node scripts/install-third-party-skills.js --yes")
    lines.push("- 安裝後會更新 memory/index.json 的 thirdPartySkills.initializedAt。")
    lines.push("- 不要自動安裝 proprietary 或 unknown-license skills；請參考 THIRD_PARTY_SKILLS.md。")
  }

  if (active) {
    lines.push("")
    lines.push("最近的酷東西：")
    lines.push(`- 名稱：${active.name}`)
    lines.push(`- Slug：${active.slug}`)
    lines.push(`- 階段：${active.stage}`)
    lines.push(`- 狀態：${active.status}`)
    lines.push(`- 下一步：${active.nextStep}`)
    lines.push("- 請先問使用者要續做這個，還是開始新的酷東西。")
  } else {
    lines.push("")
    lines.push("目前沒有已記錄的酷東西。請引導使用者從一句話想法開始。")
  }

  return lines.join("\n")
}

function outputForTool(tool, context) {
  if (tool === "codex-json") {
    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: context,
      },
    })
  }

  if (tool === "claude-json") {
    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: context,
      },
    })
  }

  return context
}

const input = parseJson(readStdin())
const root = findProjectRoot(input.cwd || process.env.CLAUDE_PROJECT_DIR || process.env.PWD || process.cwd())
const tool = process.argv.includes("--codex-json")
  ? "codex-json"
  : process.argv.includes("--claude-json")
    ? "claude-json"
    : "plain"

process.stdout.write(outputForTool(tool, buildContext(root)))
