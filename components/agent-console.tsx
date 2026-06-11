"use client"

import { useState } from "react"
import {
  ArrowUp,
  Check,
  CircleAlert,
  Download,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Square,
} from "lucide-react"

import { Markdown } from "@/components/markdown"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useAgentStream } from "@/hooks/use-agent-stream"
import type { AgentFile } from "@/lib/agent-events"

const MAX_INSTRUCTIONS_LENGTH = 4000

const EXAMPLES = [
  "Fetch the latest AI news from the web and save them into a CSV",
  "Compare the top 3 TypeScript runtimes in a table",
  "Summarize what changed in the latest Next.js release",
]

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === "text/csv" || mimeType.includes("spreadsheet"))
    return <FileSpreadsheet />
  if (mimeType === "application/json") return <FileJson />
  if (mimeType.startsWith("image/")) return <FileImage />
  return <FileText />
}

function downloadFile(file: AgentFile) {
  const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mimeType }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = file.name.replaceAll("/", "-")
  anchor.click()
  URL.revokeObjectURL(url)
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
      {children}
    </h2>
  )
}

export function AgentConsole() {
  const [instructions, setInstructions] = useState("")
  const { status, text, activities, files, stats, error, run, stop } =
    useAgentStream()

  const busy = status === "starting" || status === "streaming"
  const canSubmit = instructions.trim().length > 0 && !busy

  const submit = () => {
    if (canSubmit) run(instructions)
  }

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="rounded-2xl border bg-card shadow-sm transition-shadow focus-within:border-ring/60 focus-within:shadow-md"
      >
        <Textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault()
              submit()
            }
          }}
          placeholder="Give the agent instructions — it can search the web and save files for you…"
          maxLength={MAX_INSTRUCTIONS_LENGTH}
          aria-label="Instructions for the agent"
          className="max-h-64 min-h-28 resize-none rounded-2xl border-0 bg-transparent px-4 pt-4 pb-2 !text-base shadow-none focus-visible:border-transparent focus-visible:ring-0 md:!text-base dark:bg-transparent"
        />
        <div className="flex items-center justify-between gap-2 px-4 pb-3">
          <span className="text-xs text-muted-foreground">
            {busy ? "The agent is working…" : "⌘⏎ to run"}
          </span>
          {busy ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={stop}
              aria-label="Stop the agent"
              className="rounded-full"
            >
              <Square className="fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!canSubmit}
              aria-label="Run the agent"
              className="rounded-full"
            >
              <ArrowUp />
            </Button>
          )}
        </div>
      </form>

      {status === "idle" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setInstructions(example)}
              className="rounded-full border bg-card px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {status !== "idle" && (
        <div className="mt-10 space-y-8">
          {activities.length > 0 && (
            <section>
              <SectionLabel>Activity</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {activities.map((activity) => (
                  <Badge
                    key={activity.id}
                    variant="outline"
                    className="h-auto animate-in gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-normal text-muted-foreground fade-in slide-in-from-bottom-1"
                  >
                    {activity.done ? (
                      <Check className="text-primary" />
                    ) : (
                      <LoaderCircle className="animate-spin text-primary" />
                    )}
                    {activity.label}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {status === "starting" && (
            <section aria-live="polite">
              <SectionLabel>Response</SectionLabel>
              <div className="space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Starting the agent…
              </p>
            </section>
          )}

          {text.length > 0 && (
            <section aria-live="polite">
              <SectionLabel>Response</SectionLabel>
              <Markdown>{text}</Markdown>
              {status === "streaming" && (
                <span
                  aria-hidden
                  className="mt-1 inline-block h-5 w-2 animate-blink rounded-[1px] bg-primary"
                />
              )}
            </section>
          )}

          {files.length > 0 && (
            <section>
              <SectionLabel>Files</SectionLabel>
              <div className="grid gap-2 sm:grid-cols-2">
                {files.map((file) => (
                  <div
                    key={file.name}
                    className="flex animate-in items-center gap-3 rounded-xl border bg-card p-3 fade-in slide-in-from-bottom-1"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">
                      <FileIcon mimeType={file.mimeType} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(file.size)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => downloadFile(file)}
                      aria-label={`Download ${file.name}`}
                    >
                      <Download />
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {status === "done" && stats && (
            <p className="font-mono text-xs text-muted-foreground">
              Done in {formatDuration(stats.durationMs)} · {stats.numTurns}{" "}
              {stats.numTurns === 1 ? "turn" : "turns"} · $
              {stats.costUsd.toFixed(2)}
            </p>
          )}

          {status === "stopped" && (
            <p className="text-xs text-muted-foreground">
              Stopped — keeping what the agent had so far.
            </p>
          )}

          {status === "error" && (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
