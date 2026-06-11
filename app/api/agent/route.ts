import { randomUUID } from "node:crypto"
import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { query, type McpServerConfig } from "@anthropic-ai/claude-agent-sdk"
import Anthropic from "@anthropic-ai/sdk"

import {
  toolLabel,
  type AgentEvent,
  type AgentVerdict,
} from "@/lib/agent-events"
import { inferTransport, parseMcpServerInputs } from "@/lib/mcp"

const MODEL = "claude-opus-4-8"
const MAX_INSTRUCTIONS_LENGTH = 4000
const MAX_TURNS = 16
const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_TOTAL_FILE_BYTES = 20 * 1024 * 1024

const READ_ONLY_TOOLS = [
  "WebSearch",
  "WebFetch",
  "Read",
  "Glob",
  "Grep",
  "TodoWrite",
]
const WRITE_TOOLS = ["Write", "Edit"]

const SYSTEM_PROMPT = `You are a helpful research agent inside a small demo app. The user gives you one set of instructions; complete the task in a single run without asking follow-up questions.

- You can search the web (WebSearch, WebFetch) and read files.
- When the user asks you to save, export, or create a file (CSV, markdown, etc.), write it to your current working directory with the Write tool — every file there is offered to the user as a download when you finish. Never write anywhere else.
- Answer in well-structured markdown. Keep the final summary concise and mention any files you created.`

const MIME_TYPES: Record<string, string> = {
  ".csv": "text/csv",
  ".json": "application/json",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".html": "text/html",
  ".xml": "application/xml",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".zip": "application/zip",
}

const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    fulfilled: { type: "string", enum: ["yes", "partial", "no"] },
    summary: { type: "string" },
  },
  required: ["fulfilled", "summary"],
  additionalProperties: false,
} as const

async function evaluateRun(
  instructions: string,
  resultText: string,
  fileNames: string[]
): Promise<AgentVerdict> {
  const client = new Anthropic()
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 512,
    system:
      "You judge whether an AI agent fulfilled the user's instructions. You are given the instructions, the agent's final answer, and the names of any files it created. Be strict but fair: 'yes' if everything asked for was delivered, 'partial' if some of it was, 'no' if it was not. Summarize your verdict in one or two sentences addressed to the user.",
    messages: [
      {
        role: "user",
        content: [
          `<instructions>\n${instructions}\n</instructions>`,
          `<final_answer>\n${resultText}\n</final_answer>`,
          `<files_created>\n${fileNames.length > 0 ? fileNames.join("\n") : "(none)"}\n</files_created>`,
        ].join("\n\n"),
      },
    ],
    output_config: { format: { type: "json_schema", schema: VERDICT_SCHEMA } },
  })
  const text = response.content.find((block) => block.type === "text")?.text
  if (!text) throw new Error("empty verdict response")
  return JSON.parse(text) as AgentVerdict
}

function friendlyError(subtype: string): string {
  switch (subtype) {
    case "error_max_turns":
      return "The agent hit its turn limit before finishing. Try a narrower set of instructions."
    case "error_max_budget_usd":
      return "The agent hit its budget limit before finishing."
    default:
      return "The agent ran into an error while working. Please try again."
  }
}

function isInside(dir: string, target: string): boolean {
  const resolved = path.resolve(dir, target)
  return resolved === dir || resolved.startsWith(dir + path.sep)
}

export async function POST(request: Request) {
  let instructions: unknown
  let mcpServersInput: unknown
  try {
    ;({ instructions, mcpServers: mcpServersInput } = await request.json())
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  if (typeof instructions !== "string" || instructions.trim().length === 0) {
    return Response.json(
      { error: "Instructions are required." },
      { status: 400 }
    )
  }
  if (instructions.length > MAX_INSTRUCTIONS_LENGTH) {
    return Response.json(
      {
        error: `Instructions are too long (max ${MAX_INSTRUCTIONS_LENGTH} characters).`,
      },
      { status: 400 }
    )
  }
  const mcpResult = parseMcpServerInputs(mcpServersInput)
  if ("error" in mcpResult) {
    return Response.json({ error: mcpResult.error }, { status: 400 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local, add your key, and restart the dev server.",
      },
      { status: 500 }
    )
  }

  const prompt = instructions.trim()
  const runDir = path.join(os.tmpdir(), "duvo-agent-runs", randomUUID())
  await mkdir(runDir, { recursive: true })

  const mcpServers: Record<string, McpServerConfig> = {}
  for (const server of mcpResult.servers) {
    mcpServers[server.name] = {
      type: inferTransport(server.url),
      url: server.url,
    }
  }
  const systemPrompt =
    mcpResult.servers.length > 0
      ? `${SYSTEM_PROMPT}\n- The user connected these MCP servers, which give you extra tools: ${mcpResult.servers.map((server) => server.name).join(", ")}. Use those tools when they help with the task.`
      : SYSTEM_PROMPT

  const abort = new AbortController()
  request.signal.addEventListener("abort", () => abort.abort())

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      const send = (event: AgentEvent) => {
        if (closed) return
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          )
        } catch {
          closed = true
        }
      }

      const sendRunFiles = async () => {
        let totalBytes = 0
        const entries = await readdir(runDir, { recursive: true })
        for (const entry of entries.sort()) {
          const filePath = path.join(runDir, entry)
          const info = await stat(filePath)
          if (!info.isFile()) continue
          if (
            info.size > MAX_FILE_BYTES ||
            totalBytes + info.size > MAX_TOTAL_FILE_BYTES
          ) {
            send({
              type: "text",
              delta: `\n\n> ${entry} was too large to offer as a download.`,
            })
            continue
          }
          totalBytes += info.size
          send({
            type: "file",
            name: entry,
            mimeType:
              MIME_TYPES[path.extname(entry).toLowerCase()] ??
              "application/octet-stream",
            size: info.size,
            base64: (await readFile(filePath)).toString("base64"),
          })
        }
      }

      try {
        const result = query({
          prompt,
          options: {
            model: MODEL,
            systemPrompt,
            cwd: runDir,
            tools: [...READ_ONLY_TOOLS, ...WRITE_TOOLS],
            allowedTools: READ_ONLY_TOOLS,
            mcpServers,
            strictMcpConfig: true,
            canUseTool: async (toolName, input) => {
              if (READ_ONLY_TOOLS.includes(toolName)) {
                return { behavior: "allow", updatedInput: input }
              }
              // MCP tools come only from servers the user connected above.
              if (toolName.startsWith("mcp__")) {
                return { behavior: "allow", updatedInput: input }
              }
              if (WRITE_TOOLS.includes(toolName)) {
                const filePath = input.file_path
                if (
                  typeof filePath === "string" &&
                  isInside(runDir, filePath)
                ) {
                  return { behavior: "allow", updatedInput: input }
                }
                return {
                  behavior: "deny",
                  message: `Only files inside your working directory (${runDir}) can be written. Write the file there instead.`,
                }
              }
              return {
                behavior: "deny",
                message: "This tool is not available in this demo.",
              }
            },
            maxTurns: MAX_TURNS,
            includePartialMessages: true,
            abortController: abort,
            settingSources: [],
            stderr: (data) => console.error("[agent]", data),
          },
        })

        for await (const message of result) {
          if (message.type === "system" && message.subtype === "init") {
            send({
              type: "init",
              model: message.model,
              mcpServers: message.mcp_servers.map(({ name, status }) => ({
                name,
                status,
              })),
            })
          } else if (
            message.type === "stream_event" &&
            message.parent_tool_use_id === null
          ) {
            const { event } = message
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              send({ type: "text", delta: event.delta.text })
            }
          } else if (message.type === "assistant") {
            for (const block of message.message.content) {
              if (block.type === "tool_use") {
                send({
                  type: "tool_start",
                  id: block.id,
                  name: block.name,
                  label: toolLabel(
                    block.name,
                    block.input as Record<string, unknown>
                  ),
                })
              }
            }
          } else if (
            message.type === "user" &&
            Array.isArray(message.message.content)
          ) {
            for (const block of message.message.content) {
              if (block.type === "tool_result") {
                send({ type: "tool_end", id: block.tool_use_id })
              }
            }
          } else if (message.type === "result") {
            if (message.subtype === "success") {
              try {
                send({
                  type: "tool_start",
                  id: "verdict",
                  name: "verdict",
                  label: "Checking the result against your instructions",
                })
                const entries = await readdir(runDir, { recursive: true })
                const fileNames = []
                for (const entry of entries.sort()) {
                  const info = await stat(path.join(runDir, entry))
                  if (info.isFile()) fileNames.push(entry)
                }
                const verdict = await evaluateRun(
                  prompt,
                  message.result,
                  fileNames
                )
                send({ type: "tool_end", id: "verdict" })
                send({ type: "verdict", ...verdict })
              } catch (error) {
                // The evaluation is best-effort; never fail the run over it.
                console.error("[agent] verdict failed:", error)
                send({ type: "tool_end", id: "verdict" })
              }
              await sendRunFiles()
              send({
                type: "done",
                durationMs: message.duration_ms,
                numTurns: message.num_turns,
                costUsd: message.total_cost_usd,
              })
            } else {
              send({ type: "error", message: friendlyError(message.subtype) })
            }
          }
        }
      } catch (error) {
        if (!abort.signal.aborted) {
          console.error("[agent] run failed:", error)
          send({
            type: "error",
            message: "The agent failed to run. Check the server logs.",
          })
        }
      } finally {
        closed = true
        try {
          controller.close()
        } catch {
          // already closed
        }
        await rm(runDir, { recursive: true, force: true })
      }
    },
    cancel() {
      abort.abort()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
