#!/usr/bin/env node

const fs = require("fs")
const os = require("os")
const path = require("path")
const { execFileSync } = require("child_process")

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch {
    return fallback
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function findProjectRoot(start) {
  let current = path.resolve(start || process.cwd())
  while (true) {
    if (fs.existsSync(path.join(current, "third-party-skills.json"))) return current

    const parent = path.dirname(current)
    if (parent === current) return path.resolve(start || process.cwd())
    current = parent
  }
}

function parseArgs(argv) {
  const args = {
    all: false,
    allowRestricted: false,
    dryRun: false,
    force: false,
    list: false,
    names: [],
    targets: undefined,
    tool: "",
    yes: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--all") args.all = true
    else if (arg === "--allow-restricted") args.allowRestricted = true
    else if (arg === "--dry-run") args.dryRun = true
    else if (arg === "--force") args.force = true
    else if (arg === "--list") args.list = true
    else if (arg === "--yes" || arg === "-y") args.yes = true
    else if (arg === "--include") args.names.push(argv[++index])
    else if (arg === "--target") args.targets = argv[++index].split(",").map((item) => item.trim())
    else if (arg === "--tool") args.tool = argv[++index] || ""
    else if (!arg.startsWith("-")) args.names.push(arg)
  }

  return args
}

function normalizeTool(tool) {
  const aliases = {
    claude: "claude-code",
    claude_code: "claude-code",
    claudeCode: "claude-code",
    opencode: "opencode",
    codex: "codex",
  }
  return aliases[tool] || tool
}

function detectTool(args) {
  if (args.tool) return normalizeTool(args.tool)
  if (process.env.OPENCODE_YABR_TOOL) return normalizeTool(process.env.OPENCODE_YABR_TOOL)
  if (process.env.CLAUDE_PROJECT_DIR) return "claude-code"
  return "opencode"
}

function resolveTargets(manifest, args, tool) {
  if (args.targets) return args.targets
  const target = manifest.targets?.[tool]
  if (!target) throw new Error(`No target configured for tool: ${tool}`)
  return [target]
}

function isRestricted(skill) {
  return ["unknown", "proprietary"].includes(skill.license) || skill.license.includes("Commons Clause")
}

function selectedSkills(manifest, args) {
  const requested = new Set(args.names.filter(Boolean))
  return manifest.skills.filter((skill) => {
    if (requested.size > 0) return requested.has(skill.name)
    if (args.all) return skill.installable !== false
    return skill.default === true
  })
}

function runGit(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
}

function gitDownload(skill, destination) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "yabr-skill-"))
  try {
    runGit(["clone", "--depth", "1", "--filter=blob:none", "--sparse", `https://github.com/${skill.source}.git`, temp], process.cwd())
    runGit(["sparse-checkout", "set", skill.path], temp)
    const sourcePath = path.join(temp, skill.path)
    fs.cpSync(sourcePath, destination, { recursive: true })
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
}

function installSkill(root, skill, targets, args) {
  if (skill.installable === false) {
    throw new Error(`${skill.name} is not installable by this script: ${skill.notes || skill.license}`)
  }

  if (isRestricted(skill) && !args.allowRestricted) {
    throw new Error(`${skill.name} uses ${skill.license}; pass --allow-restricted if you accept its terms.`)
  }

  for (const target of targets) {
    const destination = path.join(root, target, skill.name)
    if (args.dryRun) {
      console.log(`[dry-run] install ${skill.name} -> ${target}`)
      continue
    }

    if (fs.existsSync(destination)) {
      if (!args.force) {
        console.log(`skip ${skill.name} -> ${target}; already exists (use --force to overwrite)`)
        continue
      }
      fs.rmSync(destination, { recursive: true, force: true })
    }

    fs.mkdirSync(path.dirname(destination), { recursive: true })
    gitDownload(skill, destination)
    console.log(`installed ${skill.name} -> ${target}`)
  }
}

function updateMemory(root, installed, args, tool, targets) {
  if (args.dryRun) return

  const memoryPath = path.join(root, "memory", "index.json")
  const memory = readJson(memoryPath, { version: 1, activeCoolThing: null, recentCoolThings: [], coolThings: [] })
  memory.thirdPartySkills ??= {}
  memory.thirdPartySkills[tool] = {
    initializedAt: new Date().toISOString(),
    targets,
    installed: installed.map((skill) => ({ name: skill.name, source: skill.source, license: skill.license })),
  }
  writeJson(memoryPath, memory)
}

function printList(manifest) {
  console.log("Targets:")
  for (const [tool, target] of Object.entries(manifest.targets || {})) {
    console.log(`${tool}\t${target}`)
  }
  console.log("")
  console.log("Skills:")
  for (const skill of manifest.skills) {
    const marker = skill.default ? "default" : "optional"
    const installable = skill.installable === false ? "not-installable" : "installable"
    console.log(`${skill.name}\t${marker}\t${installable}\t${skill.license}\t${skill.source}/${skill.path}`)
  }
}

function main() {
  const root = findProjectRoot(process.cwd())
  const args = parseArgs(process.argv.slice(2))
  const manifest = readJson(path.join(root, "third-party-skills.json"), undefined)
  if (!manifest) throw new Error("third-party-skills.json not found")

  if (args.list) {
    printList(manifest)
    return
  }

  const tool = detectTool(args)
  const targets = resolveTargets(manifest, args, tool)
  const skills = selectedSkills(manifest, args)
  if (skills.length === 0) throw new Error("No skills selected")

  if (!args.yes && !args.dryRun) {
    console.log("This will install third-party skills from their source repositories.")
    console.log(`Target tool: ${tool}`)
    console.log(`Target directory: ${targets.join(", ")}`)
    console.log("Review THIRD_PARTY_SKILLS.md and each source license before continuing.")
    console.log("Re-run with --yes to continue.")
    return
  }

  const installed = []
  for (const skill of skills) {
    installSkill(root, skill, targets, args)
    installed.push(skill)
  }
  updateMemory(root, installed, args, tool, targets)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
