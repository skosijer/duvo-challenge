// Shared MCP server model between the client panel (which persists entries in
// localStorage) and the API route (which forwards the enabled servers to the
// Claude Agent SDK for one run).

export const MAX_MCP_SERVERS = 8
export const MAX_MCP_URL_LENGTH = 2048

const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$/

// What the client stores and manages.
export type McpServerEntry = {
  id: string
  name: string
  url: string
  enabled: boolean
}

// Wire format POSTed to /api/agent — enabled servers only.
export type McpServerInput = {
  name: string
  url: string
}

export function validateMcpName(name: string): string | null {
  if (!NAME_PATTERN.test(name)) {
    return "Names can use letters, numbers, dashes and underscores (max 32 characters)."
  }
  return null
}

export function validateMcpUrl(url: string): string | null {
  if (url.length > MAX_MCP_URL_LENGTH) {
    return "That URL is too long."
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return "Enter a full URL, like https://mcp.example.com/mcp."
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return "Only http(s) MCP servers are supported."
  }
  return null
}

// Remote MCP servers speak streamable HTTP except legacy SSE endpoints, which
// by convention live at an /sse path.
export function inferTransport(url: string): "http" | "sse" {
  try {
    return new URL(url).pathname.endsWith("/sse") ? "sse" : "http"
  } catch {
    return "http"
  }
}

// Validates the untrusted `mcpServers` value from the request body.
export function parseMcpServerInputs(
  value: unknown
): { servers: McpServerInput[] } | { error: string } {
  if (value === undefined || value === null) return { servers: [] }
  if (!Array.isArray(value)) {
    return { error: "mcpServers must be an array." }
  }
  if (value.length > MAX_MCP_SERVERS) {
    return {
      error: `At most ${MAX_MCP_SERVERS} MCP servers can be connected.`,
    }
  }
  const servers: McpServerInput[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      return { error: "Each MCP server needs a name and a URL." }
    }
    const { name, url } = item as Record<string, unknown>
    if (typeof name !== "string" || typeof url !== "string") {
      return { error: "Each MCP server needs a name and a URL." }
    }
    if (validateMcpName(name) !== null || validateMcpUrl(url) !== null) {
      return { error: `MCP server “${name}” has an invalid name or URL.` }
    }
    if (seen.has(name)) {
      return { error: `Duplicate MCP server name “${name}”.` }
    }
    seen.add(name)
    servers.push({ name, url })
  }
  return { servers }
}
