"use client"

import { useState } from "react"
import { ChevronRight, Plus, Trash2, Unplug } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { McpStatus } from "@/lib/agent-events"
import type { McpServerEntry } from "@/lib/mcp"
import { cn } from "@/lib/utils"

type McpServerPanelProps = {
  servers: McpServerEntry[]
  statuses: McpStatus[]
  onAdd: (name: string, url: string) => string | null
  onRemove: (id: string) => void
  onToggle: (id: string, enabled: boolean) => void
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  connected: { label: "connected", className: "text-primary" },
  pending: { label: "connecting…", className: "text-muted-foreground" },
  failed: { label: "failed", className: "text-destructive" },
  "needs-auth": { label: "needs auth", className: "text-destructive" },
}

function StatusLabel({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? {
    label: status,
    className: "text-muted-foreground",
  }
  return (
    <span className={cn("font-mono text-[10px] uppercase", style.className)}>
      {style.label}
    </span>
  )
}

export function McpServerPanel({
  servers,
  statuses,
  onAdd,
  onRemove,
  onToggle,
}: McpServerPanelProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [error, setError] = useState<string | null>(null)

  const enabledCount = servers.filter((server) => server.enabled).length

  const submit = () => {
    const result = onAdd(name, url)
    setError(result)
    if (result === null) {
      setName("")
      setUrl("")
    }
  }

  return (
    <section className="mt-4 rounded-2xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <Unplug className="size-4 text-primary" />
          MCP servers
          {servers.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              {enabledCount} of {servers.length} on
            </span>
          )}
        </span>
        <ChevronRight
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t px-4 py-3">
          {servers.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Connect a remote MCP server by URL to give the agent extra tools.
              Toggle a server off to keep it in the list without using it.
            </p>
          ) : (
            <ul className="divide-y">
              {servers.map((server) => {
                const status = statuses.find(
                  (entry) => entry.name === server.name
                )
                return (
                  <li key={server.id} className="flex items-center gap-3 py-2">
                    <Switch
                      checked={server.enabled}
                      onCheckedChange={(enabled) =>
                        onToggle(server.id, enabled)
                      }
                      aria-label={`Turn ${server.name} ${server.enabled ? "off" : "on"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className={cn(!server.enabled && "opacity-50")}>
                          {server.name}
                        </span>
                        {server.enabled && status && (
                          <StatusLabel status={status.status} />
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {server.url}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onRemove(server.id)}
                      aria-label={`Remove ${server.name}`}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
            className="flex gap-2"
          >
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name"
              aria-label="MCP server name"
              className="w-32 shrink-0"
            />
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://mcp.example.com/mcp"
              aria-label="MCP server URL"
              className="min-w-0 flex-1"
            />
            <Button
              type="submit"
              size="icon"
              variant="outline"
              disabled={name.trim().length === 0 || url.trim().length === 0}
              aria-label="Add MCP server"
              className="shrink-0"
            >
              <Plus />
            </Button>
          </form>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </section>
  )
}
