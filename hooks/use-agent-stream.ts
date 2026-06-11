"use client"

import { useCallback, useRef, useState } from "react"

import type {
  AgentEvent,
  AgentFile,
  AgentStats,
  AgentVerdict,
  McpStatus,
} from "@/lib/agent-events"
import type { McpServerInput } from "@/lib/mcp"

export type AgentStatus =
  | "idle"
  | "starting"
  | "streaming"
  | "done"
  | "error"
  | "stopped"

export type AgentActivity = { id: string; label: string; done: boolean }

type AgentState = {
  status: AgentStatus
  text: string
  activities: AgentActivity[]
  files: AgentFile[]
  mcpStatuses: McpStatus[]
  verdict?: AgentVerdict
  stats?: AgentStats
  error?: string
}

const INITIAL_STATE: AgentState = {
  status: "idle",
  text: "",
  activities: [],
  files: [],
  mcpStatuses: [],
}

function reduceEvent(prev: AgentState, event: AgentEvent): AgentState {
  switch (event.type) {
    case "init":
      return { ...prev, status: "streaming", mcpStatuses: event.mcpServers }
    case "text":
      return { ...prev, status: "streaming", text: prev.text + event.delta }
    case "tool_start":
      return {
        ...prev,
        status: "streaming",
        activities: [
          ...prev.activities,
          { id: event.id, label: event.label, done: false },
        ],
      }
    case "tool_end":
      return {
        ...prev,
        activities: prev.activities.map((a) =>
          a.id === event.id ? { ...a, done: true } : a
        ),
      }
    case "file":
      return {
        ...prev,
        files: [
          ...prev.files,
          {
            name: event.name,
            mimeType: event.mimeType,
            size: event.size,
            base64: event.base64,
          },
        ],
      }
    case "verdict":
      return {
        ...prev,
        verdict: { fulfilled: event.fulfilled, summary: event.summary },
      }
    case "done":
      return {
        ...prev,
        status: "done",
        activities: prev.activities.map((a) => ({ ...a, done: true })),
        stats: {
          durationMs: event.durationMs,
          numTurns: event.numTurns,
          costUsd: event.costUsd,
        },
      }
    case "error":
      return { ...prev, status: "error", error: event.message }
  }
}

export function useAgentStream() {
  const [state, setState] = useState<AgentState>(INITIAL_STATE)
  const abortRef = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const run = useCallback(
    async (instructions: string, mcpServers: McpServerInput[] = []) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setState({ ...INITIAL_STATE, status: "starting" })

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instructions, mcpServers }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          let message = "Something went wrong. Please try again."
          try {
            const data = (await res.json()) as { error?: string }
            if (typeof data.error === "string") message = data.error
          } catch {
            // non-JSON error response; keep the generic message
          }
          setState((prev) => ({ ...prev, status: "error", error: message }))
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const frames = buffer.split("\n\n")
          buffer = frames.pop() ?? ""
          for (const frame of frames) {
            const line = frame.trim()
            if (!line.startsWith("data: ")) continue
            const event = JSON.parse(line.slice("data: ".length)) as AgentEvent
            setState((prev) => reduceEvent(prev, event))
          }
        }

        // Stream closed without a terminal done/error event.
        setState((prev) =>
          prev.status === "starting" || prev.status === "streaming"
            ? {
                ...prev,
                status: "error",
                error: "The connection closed before the agent finished.",
              }
            : prev
        )
      } catch {
        if (controller.signal.aborted) {
          setState((prev) => ({
            ...prev,
            status: "stopped",
            activities: prev.activities.map((a) => ({ ...a, done: true })),
          }))
        } else {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: "Connection lost. Please try again.",
          }))
        }
      }
    },
    []
  )

  return { ...state, run, stop }
}
