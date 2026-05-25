import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { OpencodeClient } from "@opencode-ai/sdk/v2"

const MAX_TRACKED_SESSIONS = 100
const STARTUP_DELAY_MS = 3000
const MIN_DESKTOP_PROMPT_VERSION = "1.15.10"
const DESKTOP_PROVIDER_RETRY_DELAYS_MS = [3000, 7000, 15000, 30000]

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

function loadNavigatorContext(root) {
  const script = path.join(root, "scripts", "yet-another-boss-request-hook.js")
  const result = spawnSync("node", [script, "--tool", "opencode"], {
    cwd: root,
    encoding: "utf8",
  })

  if (result.status !== 0) {
    return "Yet Another Boss Request context failed to load. Read AGENTS.md before responding."
  }

  return result.stdout.trim()
}

function loadConfiguredOptions(root, options = {}) {
  const configPaths = [path.join(root, "opencode.json"), path.join(root, ".opencode", "opencode.json")]
  for (const configPath of configPaths) {
    try {
      if (!fs.existsSync(configPath)) continue
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"))
      for (const entry of config.plugin || []) {
        if (!Array.isArray(entry) || entry.length !== 2) continue
        const [spec, pluginOptions] = entry
        if (typeof spec !== "string" || !spec.includes("yet-another-boss-request.js")) continue
        if (!pluginOptions || typeof pluginOptions !== "object" || Array.isArray(pluginOptions)) continue
        return { ...pluginOptions, ...options }
      }
    } catch {
    }
  }

  return options
}

function hasExplicitSessionArg(argv = process.argv) {
  return argv.some((arg) => arg === "-s" || arg === "--session" || arg.startsWith("--session="))
}

function latestOpenCodeMainLaunchArgs() {
  try {
    if (!process.env.HOME) return []
    const logDir = path.join(process.env.HOME, ".local/share/opencode/log")
    if (!fs.existsSync(logDir)) return []

    const logs = fs
      .readdirSync(logDir)
      .filter((name) => name.endsWith(".log"))
      .sort()
      .reverse()
      .slice(0, 20)

    for (const log of logs) {
      const firstLine = fs.readFileSync(path.join(logDir, log), "utf8").split("\n")[0] ?? ""
      if (!firstLine.includes("process_role=main")) continue

      const match = firstLine.match(/args=(\[[^\]]*\])/)
      return match ? JSON.parse(match[1]) : []
    }
  } catch {
  }

  return []
}

function isDesktopRuntime() {
  return process.argv.some((arg) => arg.includes("OpenCode.app") || arg.includes("app.asar/out/main/sidecar.js"))
}

function readDesktopVersion() {
  try {
    const plist = fs.readFileSync("/Applications/OpenCode.app/Contents/Info.plist", "utf8")
    const match = plist.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/)
    return match?.[1] || "unknown"
  } catch {
    return "unknown"
  }
}

function compareVersions(left, right) {
  const leftParts = String(left).split(".").map((part) => Number.parseInt(part, 10) || 0)
  const rightParts = String(right).split(".").map((part) => Number.parseInt(part, 10) || 0)
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

function shouldAutoStart() {
  return (
    process.env.OPENCODE_YABR_AUTOSTART !== "0" &&
    !hasExplicitSessionArg() &&
    !hasExplicitSessionArg(latestOpenCodeMainLaunchArgs())
  )
}

function shouldPromptAsyncAutoStart() {
  if (!shouldAutoStart()) return false
  if (!isDesktopRuntime()) return true

  const version = readDesktopVersion()
  return version !== "unknown" && compareVersions(version, MIN_DESKTOP_PROMPT_VERSION) >= 0
}

function shouldDesktopFirstMessageFallback() {
  return shouldAutoStart() && isDesktopRuntime()
}

function runtimeSnapshot(root, options) {
  return JSON.stringify({
    root,
    cwd: process.cwd(),
    argv: process.argv,
    stdinTTY: process.stdin?.isTTY === true,
    stdoutTTY: process.stdout?.isTTY === true,
    envKeys: Object.keys(process.env).filter((key) => /OPENCODE|SESSION|MODEL|PROVIDER|AUTH/i.test(key)).sort(),
    desktop: isDesktopRuntime()
      ? {
          detected: true,
          version: readDesktopVersion(),
          minPromptVersion: MIN_DESKTOP_PROMPT_VERSION,
          defaultModel: options?.desktopDefaultModel || "",
        }
      : { detected: false },
  })
}

function startupPrompt() {
  return [
    "start YABR",
    "Read YABR memory and run the startup check.",
    "If third-party skills are missing, immediately ask via AskUserQuestion whether to install them.",
  ].join("\n")
}

function desktopStartupPrompt() {
  return [
    "start YABR",
    "Read YABR memory and run the startup check.",
    "Desktop startup constraint: do not call AskUserQuestion/question tools during this startup run.",
    "If third-party skills are missing or a resume/start-new decision is needed, ask in plain text with numbered options instead of using an interactive question queue.",
  ].join("\n")
}

function startupPromptForRuntime() {
  return isDesktopRuntime() ? desktopStartupPrompt() : startupPrompt()
}

function isStartupText(text) {
  return /start\s+YABR|Read YABR memory and run the startup check/i.test(text || "")
}

function prependStartupPrompt(parts) {
  if (!Array.isArray(parts)) return false
  if (parts.some((part) => part?.type === "text" && isStartupText(part.text))) return false

  const firstTextPart = parts.find((part) => part?.type === "text")
  if (!firstTextPart) return false

  firstTextPart.text = [
    startupPromptForRuntime(),
    "",
    "After completing the startup check, also respond to the user's original message below if it is still relevant.",
    "",
    firstTextPart.text || "",
  ].join("\n")
  return true
}

function makeV2Client(client) {
  const transport = client?._client
  return transport ? new OpencodeClient({ client: transport }) : undefined
}

function unwrapData(result) {
  if (result && typeof result === "object" && "error" in result && result.error) {
    throw new Error(JSON.stringify(result.error))
  }
  return result?.data
}

function countProviders(data) {
  if (Array.isArray(data)) return data.length
  if (Array.isArray(data?.providers)) return data.providers.length
  if (Array.isArray(data?.data)) return data.data.length
  return 0
}

function providerList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.providers)) return data.providers
  if (Array.isArray(data?.data)) return data.data
  return []
}

function summarizeProviders(data) {
  return providerList(data).map((provider) => ({
    id: provider?.id || "unknown",
    name: provider?.name || "unknown",
    enabledVia: provider?.enabled?.via || "unknown",
    service: provider?.enabled?.service || "unknown",
  }))
}

function countModels(data) {
  if (Array.isArray(data)) return data.length
  if (Array.isArray(data?.models)) return data.models.length
  if (Array.isArray(data?.data)) return data.data.length
  return 0
}

function modelList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.models)) return data.models
  if (Array.isArray(data?.data)) return data.data
  return []
}

function summarizeModels(data) {
  return modelList(data).slice(0, 10).map((model) => ({
    providerID: model?.providerID || "unknown",
    modelID: model?.id || "unknown",
    name: model?.name || "unknown",
  }))
}

function summarizeConfig(data) {
  return {
    model: data?.model || "",
    small_model: data?.small_model || "",
    default_agent: data?.default_agent || "",
    enabled_providers: Array.isArray(data?.enabled_providers) ? data.enabled_providers : [],
    disabled_providers: Array.isArray(data?.disabled_providers) ? data.disabled_providers : [],
  }
}

function parseModel(value) {
  if (!value || typeof value !== "string") return
  const [providerID, modelID] = value.split("/")
  if (!providerID || !modelID) return
  return { providerID, modelID }
}

function validModel(providerData, modelData, model) {
  if (!model?.providerID || !model?.modelID) return false
  const providerConnected = providerList(providerData).some((item) => item?.id === model.providerID)
  const modelAvailable = modelList(modelData).some((item) => item?.providerID === model.providerID && item?.id === model.modelID)
  return providerConnected && modelAvailable
}

function firstAvailableModel(providerData, modelData) {
  const connectedProviders = new Set(providerList(providerData).map((provider) => provider?.id).filter(Boolean))
  for (const model of modelList(modelData)) {
    if (!model?.id || !model?.providerID || !connectedProviders.has(model.providerID)) continue
    return { providerID: model.providerID, modelID: model.id }
  }
}

function firstFreeOpencodeModel(providerData, modelData) {
  const opencodeConnected = providerList(providerData).some((provider) => provider?.id === "opencode")
  if (!opencodeConnected) return

  for (const model of modelList(modelData)) {
    if (model?.providerID !== "opencode" || !model?.id) continue
    const freeByName = /free/i.test(`${model.id} ${model.name || ""}`)
    const freeByCost = Array.isArray(model.cost) && model.cost.every((cost) => (cost?.input || 0) === 0 && (cost?.output || 0) === 0)
    if (freeByName || freeByCost) return { providerID: "opencode", modelID: model.id }
  }
}

function desktopDefaultModel(providerData, modelData, options) {
  const model = parseModel(options?.desktopDefaultModel)
  if (!model) return
  return validModel(providerData, modelData, model) ? model : undefined
}

function configuredModel(providerData, modelData, config) {
  if (!config.model) return
  const model = parseModel(config.model)
  return validModel(providerData, modelData, model) ? model : undefined
}

function desktopAgent(config) {
  return config.default_agent || "build"
}

async function desktopPromptDefaults(v2, root, log, options) {
  if (!isDesktopRuntime()) return {}

  try {
    await log?.("checking Desktop provider readiness", "debug")
    const providerResult = await v2.v2.provider.list({ instance: { directory: root } })
    const providerData = unwrapData(providerResult)
    const providerCount = countProviders(providerData)
    await log?.(
      `Desktop provider readiness checked: providerCount=${providerCount} providers=${JSON.stringify(summarizeProviders(providerData))}`,
      "debug",
    )
    if (providerCount <= 0) return

    const modelResult = await v2.v2.model.list({ instance: { directory: root } })
    const modelData = unwrapData(modelResult)
    const modelCount = countModels(modelData)
    await log?.(`Desktop model readiness checked: modelCount=${modelCount} sample=${JSON.stringify(summarizeModels(modelData))}`, "debug")
    if (modelCount <= 0) return

    const configResult = await v2.config.get({ directory: root })
    const configData = unwrapData(configResult)
    const config = summarizeConfig(configData)
    await log?.(`Desktop config readiness checked: config=${JSON.stringify(config)}`, "debug")

    const model =
      desktopDefaultModel(providerData, modelData, options) ||
      configuredModel(providerData, modelData, config) ||
      firstFreeOpencodeModel(providerData, modelData) ||
      firstAvailableModel(providerData, modelData)
    const agent = desktopAgent(config)
    await log?.(`Desktop prompt defaults resolved: agent=${agent} model=${model ? `${model.providerID}/${model.modelID}` : "(missing)"}`, "debug")
    if (!model) return
    return { agent, model }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await log?.(`Desktop provider readiness check failed: ${message}`, "debug")
  }
}

function eventSessionID(event) {
  return (
    event?.properties?.sessionID ||
    event?.properties?.session?.id ||
    event?.data?.sessionID ||
    event?.data?.id ||
    event?.data?.session?.id ||
    ""
  )
}

function eventSessionTitle(event) {
  return event?.properties?.info?.title || event?.properties?.session?.title || event?.data?.title || event?.data?.session?.title || ""
}

function isSessionCreatedEvent(event) {
  return event?.type === "session.created" || event?.name === "session.created.1"
}

function rememberSession(set, sessionID) {
  set.add(sessionID)
  while (set.size > MAX_TRACKED_SESSIONS) {
    set.delete(set.values().next().value)
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function sessionHasMessages(v2, root, sessionID, log) {
  await log?.(`checking session messages: sessionID=${sessionID}`, "debug")
  const result = await v2.session.messages({ directory: root, sessionID, limit: 1 })
  const messages = unwrapData(result)
  const hasMessages = Array.isArray(messages) && messages.length > 0
  await log?.(`session messages checked: sessionID=${sessionID} hasMessages=${hasMessages}`, "debug")
  return hasMessages
}

async function sendStartupPrompt(client, v2, root, sessionID, log, options) {
  if (!sessionID) return
  await log?.(`startup prompt send requested: sessionID=${sessionID}`, "info")
  const defaults = await desktopPromptDefaults(v2, root, log, options)
  if (isDesktopRuntime() && !defaults?.model) {
    await log?.(`startup prompt skipped: Desktop provider is not ready sessionID=${sessionID}`, "info")
    return false
  }

  if (await sessionHasMessages(v2, root, sessionID, log)) {
    await log?.(`startup prompt skipped because session already has messages: sessionID=${sessionID}`, "info")
    return false
  }

  await log?.(`calling session.promptAsync: sessionID=${sessionID}`, "info")
  await v2.session.promptAsync({
    sessionID,
    ...defaults,
    directory: root,
    parts: [{ type: "text", text: startupPromptForRuntime() }],
  })
  await log?.(`session.promptAsync returned: sessionID=${sessionID}`, "info")

  // TUI understands this event; Desktop may ignore it because its composer is app state.
  for (const delayMs of [500, 2500, 5000]) {
    setTimeout(() => {
      client?.tui
        ?.publish?.({
          directory: root,
          body: { type: "tui.session.select", properties: { sessionID } },
        })
        .catch?.(() => {})
    }, delayMs)
  }

  return true
}

function scheduleDesktopProviderRetry(client, v2, root, sessionID, log, state, options) {
  if (!isDesktopRuntime() || !sessionID || state.desktopProviderRetries.has(sessionID)) return
  state.desktopProviderRetries.add(sessionID)
  awaitableLog(log, `Desktop provider retry scheduled: sessionID=${sessionID} delays=${DESKTOP_PROVIDER_RETRY_DELAYS_MS.join(",")}`, "info")

  for (const delayMs of DESKTOP_PROVIDER_RETRY_DELAYS_MS) {
    setTimeout(() => {
      retryDesktopStartupPrompt(client, v2, root, sessionID, log, state, delayMs, options).catch(async (error) => {
        const message = error instanceof Error ? error.message : String(error)
        await log?.(`Desktop provider retry failed: sessionID=${sessionID} delayMs=${delayMs} error=${message}`, "error")
      })
    }, delayMs)
  }
}

function awaitableLog(log, message, level = "info") {
  log?.(message, level).catch?.(() => {})
}

async function retryDesktopStartupPrompt(client, v2, root, sessionID, log, state, delayMs, options) {
  if (state.sessions.has(sessionID)) {
    await log?.(`Desktop provider retry skipped: session already submitted sessionID=${sessionID} delayMs=${delayMs}`, "debug")
    return
  }

  await log?.(`Desktop provider retry checking readiness: sessionID=${sessionID} delayMs=${delayMs}`, "debug")
  const submitted = await sendStartupPrompt(client, v2, root, sessionID, log, options)
  if (!submitted) return

  rememberSession(state.sessions, sessionID)
  await log?.(`Desktop provider retry submitted startup prompt: sessionID=${sessionID} delayMs=${delayMs}`, "info")
}

async function autoStartNavigator(client, root, sessionID, log, options) {
  if (!shouldPromptAsyncAutoStart()) return false

  const v2 = makeV2Client(client)
  if (!v2) {
    await log("Yet Another Boss Request autostart skipped: SDK client is not ready", "debug")
    return false
  }

  const submitted = await sendStartupPrompt(client, v2, root, sessionID, log, options)
  if (!submitted) return false

  await log(`Yet Another Boss Request autostart prompt submitted to ${sessionID}`)
  return true
}

async function createStartupSession(client, root, log, state, options) {
  await log(`createStartupSession entered: shouldAutoStart=${shouldAutoStart()} shouldPromptAsyncAutoStart=${shouldPromptAsyncAutoStart()} startupRootSeen=${state.startupRoots.has(root)} pendingRoot=${state.pendingRoots.has(root)} ${runtimeSnapshot(root, options)}`, "debug")
  if (!isDesktopRuntime()) {
    await log("createStartupSession skipped: startup session bootstrap is Desktop-only", "debug")
    return false
  }
  if (!shouldPromptAsyncAutoStart()) {
    await log("createStartupSession skipped: autostart disabled", "debug")
    return false
  }
  if (state.startupRoots.has(root)) {
    await log("createStartupSession skipped: root already attempted", "debug")
    return false
  }
  if (state.pendingRoots.has(root)) {
    await log("createStartupSession skipped: root already pending", "debug")
    return false
  }

  const v2 = makeV2Client(client)
  if (!v2) {
    await log("Yet Another Boss Request startup postponed: SDK client is not ready", "debug")
    return false
  }

  state.pendingRoots.add(root)

  try {
    await log(`calling session.create: root=${root} title=YABR Startup`, "info")
    const result = await v2.session.create({
      directory: root,
      title: "YABR Startup",
    })
    await log("session.create returned", "info")

    const session = unwrapData(result)
    const sessionID = session?.id || ""
    await log(`session.create unwrapped: sessionID=${sessionID || "(missing)"}`, "info")
    if (!sessionID || state.sessions.has(sessionID) || state.pending.has(sessionID)) {
      await log(`createStartupSession skipped after create: missingOrDuplicateSession sessionID=${sessionID || "(missing)"}`, "debug")
      return false
    }

    await log(`Yet Another Boss Request startup session created: ${sessionID}`)
    state.startupRoots.add(root)

    const submitted = await autoStartNavigator(client, root, sessionID, log, options)
    if (submitted) {
      rememberSession(state.sessions, sessionID)
    } else {
      scheduleDesktopProviderRetry(client, v2, root, sessionID, log, state, options)
    }
    return submitted
  } finally {
    await log("createStartupSession finished", "debug")
    state.pendingRoots.delete(root)
  }
}

export const YetAnotherBossRequestPlugin = async ({ client, directory, worktree }, options = {}) => {
  const root = findProjectRoot(worktree || directory)
  const effectiveOptions = loadConfiguredOptions(root, options)
  const context = loadNavigatorContext(root)
  let injected = false
  const stateKey = "__yetAnotherBossRequestAutostart"
  globalThis[stateKey] ??= {}
  const state = globalThis[stateKey]
  state.sessions ??= new Set()
  state.pending ??= new Set()
  state.pendingRoots ??= new Set()
  state.firstMessages ??= new Set()
  state.startupRoots ??= new Set()
  state.desktopProviderRetries ??= new Set()

  const log = async (message, level = "info") => {
    await client?.app
      ?.log?.({
        body: {
          service: "yet-another-boss-request",
          level,
          message,
        },
      })
      .catch?.(() => {})
  }

  await log(`plugin loaded: directory=${directory || ""} worktree=${worktree || ""} root=${root} contextLength=${context.length} ${runtimeSnapshot(root, effectiveOptions)}`, "info")

  setTimeout(() => {
    log(`startup timer fired after ${STARTUP_DELAY_MS}ms`, "debug")
    createStartupSession(client, root, log, state, effectiveOptions).catch(async (error) => {
      const message = error instanceof Error ? error.message : String(error)
      await log(`Yet Another Boss Request startup failed: ${message}`, "error").catch(() => {})
    })
  }, STARTUP_DELAY_MS)

  return {
    async event({ event }) {
      if (!isSessionCreatedEvent(event)) return
      await log(`session.created event received: event=${JSON.stringify(event)}`, "debug")

      const sessionID = eventSessionID(event)
      const title = eventSessionTitle(event)
      if (isDesktopRuntime() && title === "YABR Startup") {
        await log(`session.created event skipped for plugin-created Desktop startup session: sessionID=${sessionID || "(missing)"} title=${title}`, "debug")
        return
      }

      if (!sessionID || state.sessions.has(sessionID) || state.pending.has(sessionID)) {
        await log(`session.created event skipped: sessionID=${sessionID || "(missing)"} seen=${state.sessions.has(sessionID)} pending=${state.pending.has(sessionID)}`, "debug")
        return
      }
      rememberSession(state.pending, sessionID)

      try {
        await sleep(500)
        const submitted = await autoStartNavigator(client, root, sessionID, log, effectiveOptions)
        if (submitted) rememberSession(state.sessions, sessionID)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await log(`Yet Another Boss Request autostart failed: ${message}`, "error").catch(() => {})
      } finally {
        state.pending.delete(sessionID)
      }
    },

    async "chat.message"(input, output) {
      const sessionID = input.sessionID
      await log(`chat.message hook entered: sessionID=${sessionID || "(missing)"} shouldDesktopFirstMessageFallback=${shouldDesktopFirstMessageFallback()} firstSeen=${state.firstMessages.has(sessionID)} sessionSeen=${state.sessions.has(sessionID)}`, "debug")
      if (!shouldDesktopFirstMessageFallback() || !sessionID || state.firstMessages.has(sessionID) || state.sessions.has(sessionID)) return

      const v2 = makeV2Client(client)
      if (!v2) {
        await log("chat.message skipped: SDK client is not ready", "debug")
        return
      }

      try {
        if (await sessionHasMessages(v2, root, sessionID, log)) {
          rememberSession(state.firstMessages, sessionID)
          return
        }
      } catch {
        await log(`chat.message skipped: failed to inspect messages for ${sessionID}`, "debug")
        return
      }

      if (prependStartupPrompt(output.parts)) {
        rememberSession(state.firstMessages, sessionID)
        await log(`Yet Another Boss Request startup prepended to first message in ${sessionID}`)
      }
    },

    async "experimental.chat.system.transform"(_input, output) {
      if (injected) return
      injected = true

      if (Array.isArray(output.context)) {
        output.context.push(context)
        return
      }

      if (typeof output.system === "string") {
        output.system = `${output.system}\n\n${context}`
        return
      }

      if (Array.isArray(output.messages)) {
        output.messages.unshift({ role: "system", content: context })
      }
    },

    async "experimental.session.compacting"(_input, output) {
      if (Array.isArray(output.context)) {
        output.context.push(context)
      }
    },
  }
}

export default YetAnotherBossRequestPlugin
