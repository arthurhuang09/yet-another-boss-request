import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { OpencodeClient } from "@opencode-ai/sdk/v2"

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

function shouldAutoStart() {
  return process.env.OPENCODE_YABR_AUTOSTART !== "0"
}

function startupPrompt() {
  return "auto prompt"
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

async function autoStartNavigator(client, root, log) {
  if (!shouldAutoStart()) return

  const v2 = makeV2Client(client)
  if (!v2) return

  const created = await v2.session.create({
    directory: root,
    title: "Yet Another Boss Request",
  })
  const session = unwrapData(created)
  const sessionID = session?.id
  if (!sessionID) return

  await v2.session.promptAsync({
    sessionID,
    parts: [{ type: "text", text: startupPrompt() }],
  })

  try {
    await v2.tui.selectSession({ directory: root, sessionID })
  } catch {
    // Autostart still succeeds even if the TUI cannot switch sessions.
  }

  await log("Yet Another Boss Request promptAsync autostart submitted")
}

function scheduleAutoStart(client, root, log) {
  if (!shouldAutoStart()) return

  setTimeout(() => {
    autoStartNavigator(client, root, log).catch(() => {})
  }, 1500)
}

export const YetAnotherBossRequestPlugin = async ({ client, directory, worktree }) => {
  const root = findProjectRoot(worktree || directory)
  const context = loadNavigatorContext(root)
  let injected = false
  const stateKey = "__yetAnotherBossRequestAutostart"
  globalThis[stateKey] ??= { scheduled: false, started: false }
  const state = globalThis[stateKey]

  const log = async (message) => {
    await client.app.log({
      body: {
        service: "yet-another-boss-request",
        level: "info",
        message,
      },
    })
  }

  if (!state.scheduled) {
    state.scheduled = true
    scheduleAutoStart(client, root, async (message) => {
      if (state.started) return
      state.started = true
      await log(message)
    })
  }

  return {
    async event({ event }) {
      if (event.type === "session.created") {
        await log("Yet Another Boss Request context loaded")
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
