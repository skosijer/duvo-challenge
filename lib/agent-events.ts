// Shared SSE protocol between app/api/agent/route.ts and the client stream
// reader. Wire format: `data: <JSON.stringify(AgentEvent)>\n\n` frames, ending
// with a single terminal `done` or `error` event.

export type AgentFile = {
  name: string
  mimeType: string
  size: number
  base64: string
}

export type AgentStats = {
  durationMs: number
  numTurns: number
  costUsd: number
}

export type AgentEvent =
  | { type: "init"; model: string }
  | { type: "text"; delta: string }
  | { type: "tool_start"; id: string; name: string; label: string }
  | { type: "tool_end"; id: string }
  | ({ type: "file" } & AgentFile)
  | ({ type: "done" } & AgentStats)
  | { type: "error"; message: string }

function basename(path: string) {
  return path.split("/").pop() ?? path
}

export function toolLabel(
  name: string,
  input: Record<string, unknown>
): string {
  switch (name) {
    case "WebSearch":
      return typeof input.query === "string"
        ? `Searching the web for “${input.query}”`
        : "Searching the web"
    case "WebFetch":
      return typeof input.url === "string"
        ? `Fetching ${input.url}`
        : "Fetching a page"
    case "Read":
      return typeof input.file_path === "string"
        ? `Reading ${basename(input.file_path)}`
        : "Reading a file"
    case "Write":
      return typeof input.file_path === "string"
        ? `Creating ${basename(input.file_path)}`
        : "Creating a file"
    case "Edit":
      return typeof input.file_path === "string"
        ? `Editing ${basename(input.file_path)}`
        : "Editing a file"
    case "Glob":
    case "Grep":
      return typeof input.pattern === "string"
        ? `Searching files for “${input.pattern}”`
        : "Searching files"
    case "TodoWrite":
      return "Planning the task"
    default:
      return `Using ${name}`
  }
}
