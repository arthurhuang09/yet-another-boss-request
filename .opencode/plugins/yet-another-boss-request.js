import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { OpencodeClient } from "@opencode-ai/sdk/v2"

const MAX_TRACKED_SESSIONS = 100

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

function hasExplicitSessionArg(argv = process.argv) {
  return argv.some((arg) => arg === "-s" || arg === "--session" || arg.startsWith("--session="))
}

function shouldAutoStart() {
  return process.env.OPENCODE_YABR_AUTOSTART !== "0" && !hasExplicitSessionArg()
}

function startupPrompt() {
  return [
    "start YABR",
    "Read YABR memory and run the startup check.",
    "If third-party skills are missing, immediately ask via AskUserQuestion whether to install them.",
  ].join("\n")
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

function eventSessionID(event) {
  return event?.properties?.sessionID || event?.data?.sessionID || ""
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

async function sessionHasMessages(v2, root, sessionID) {
  const result = await v2.session.messages({ directory: root, sessionID, limit: 1 })
  const messages = unwrapData(result)
  return Array.isArray(messages) && messages.length > 0
}

async function autoStartNavigator(client, root, sessionID, log) {
  if (!shouldAutoStart()) return
  if (!sessionID) return

  const v2 = makeV2Client(client)
  if (!v2) return

  if (await sessionHasMessages(v2, root, sessionID)) return

  await v2.session.promptAsync({
    sessionID,
    directory: root,
    parts: [{ type: "text", text: startupPrompt() }],
  })

  await log("Yet Another Boss Request promptAsync autostart submitted")
}

export const YetAnotherBossRequestPlugin = async ({ client, directory, worktree }) => {
  const root = findProjectRoot(worktree || directory)
  const context = loadNavigatorContext(root)
  let injected = false
  const stateKey = "__yetAnotherBossRequestAutostart"
  globalThis[stateKey] ??= {}
  const state = globalThis[stateKey]
  state.sessions ??= new Set()
  state.pending ??= new Set()

  const log = async (message, level = "info") => {
    await client.app.log({
      body: {
        service: "yet-another-boss-request",
        level,
        message,
      },
    })
  }

  return {
    async event({ event }) {
      if (!isSessionCreatedEvent(event)) return

      const sessionID = eventSessionID(event)
      if (!sessionID || state.sessions.has(sessionID) || state.pending.has(sessionID)) return
      rememberSession(state.pending, sessionID)

      try {
        await autoStartNavigator(client, root, sessionID, log)
        rememberSession(state.sessions, sessionID)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await log(`Yet Another Boss Request autostart failed: ${message}`, "error").catch(() => {})
      } finally {
        state.pending.delete(sessionID)
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
