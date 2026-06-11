"use client"

import { useCallback, useSyncExternalStore } from "react"

import {
  MAX_MCP_SERVERS,
  validateMcpName,
  validateMcpUrl,
  type McpServerEntry,
} from "@/lib/mcp"

const STORAGE_KEY = "duvo:mcp-servers"

// localStorage exposed as an external store so hydration stays consistent:
// the server (and first client render) sees an empty list, then React swaps
// in the persisted one.
const EMPTY: McpServerEntry[] = []
let cache: McpServerEntry[] | null = null
const listeners = new Set<() => void>()

function loadServers(): McpServerEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return EMPTY
    return parsed.filter(
      (entry): entry is McpServerEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.id === "string" &&
        typeof entry.name === "string" &&
        typeof entry.url === "string" &&
        typeof entry.enabled === "boolean"
    )
  } catch {
    return EMPTY
  }
}

function getSnapshot(): McpServerEntry[] {
  cache ??= loadServers()
  return cache
}

function getServerSnapshot(): McpServerEntry[] {
  return EMPTY
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setStore(next: McpServerEntry[]) {
  cache = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // storage unavailable (private mode, quota) — keep the in-memory list
  }
  for (const listener of listeners) listener()
}

export function useMcpServers() {
  const servers = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  /** Returns an error message, or null when the server was added. */
  const add = useCallback((name: string, url: string): string | null => {
    const current = getSnapshot()
    const trimmedName = name.trim()
    const trimmedUrl = url.trim()
    const nameError = validateMcpName(trimmedName)
    if (nameError) return nameError
    const urlError = validateMcpUrl(trimmedUrl)
    if (urlError) return urlError
    if (current.length >= MAX_MCP_SERVERS) {
      return `You can connect up to ${MAX_MCP_SERVERS} servers.`
    }
    if (current.some((server) => server.name === trimmedName)) {
      return `“${trimmedName}” is already connected.`
    }
    setStore([
      ...current,
      {
        id: crypto.randomUUID(),
        name: trimmedName,
        url: trimmedUrl,
        enabled: true,
      },
    ])
    return null
  }, [])

  const remove = useCallback((id: string) => {
    setStore(getSnapshot().filter((server) => server.id !== id))
  }, [])

  const toggle = useCallback((id: string, enabled: boolean) => {
    setStore(
      getSnapshot().map((server) =>
        server.id === id ? { ...server, enabled } : server
      )
    )
  }, [])

  return { servers, add, remove, toggle }
}
