# Duvo Agent Console

A one-shot research agent you can watch work in real time. Give it a set of instructions, and it searches the web, reads pages, writes files, and streams every step back to the browser — tool calls, partial answers, downloadable artifacts, and a final self-evaluation of whether it actually did what you asked.

Built with [Next.js 16](https://nextjs.org), the [Claude Agent SDK](https://platform.claude.com/docs/en/api/agent-sdk/overview), and [shadcn/ui](https://ui.shadcn.com).

## What it does

- **Single-run agent** — type instructions (or pick an example), hit run, and the agent completes the task in one pass with no follow-up questions. Powered by Claude Opus running through the Agent SDK.
- **Live streaming console** — tool activity and the answer stream in over Server-Sent Events as they happen, rendered as markdown.
- **File artifacts** — ask for a CSV, report, or any other file and the agent writes it to a sandboxed per-run directory. Everything it creates is offered as a download when the run finishes.
- **Bring your own MCP servers** — connect remote MCP servers by URL from the side panel to give the agent extra tools; connection status (connected / pending / failed / needs auth) is shown live.
- **Response evaluation** — after each successful run, a second Claude call judges the result against your original instructions and reports a verdict: fulfilled, partial, or not fulfilled.
- **Guardrails** — the agent gets a curated read-only toolset (web search/fetch, file reads, grep/glob), writes are confined to the run's temp directory, runs are capped at 16 turns, and the working directory is deleted when the run ends.

## Getting started

Requires Node.js and [pnpm](https://pnpm.io).

```bash
# 1. Install dependencies
pnpm install

# 2. Configure your API key
cp .env.example .env.local
# then add your key from https://platform.claude.com/settings/keys

# 3. Run the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and give the agent something to do — for example:

> Fetch the latest AI news from the web and save them into a CSV

**Tip:** press `d` anywhere in the app to toggle dark mode.

## Scripts

| Command          | What it does                         |
| ---------------- | ------------------------------------ |
| `pnpm dev`       | Start the dev server                 |
| `pnpm build`     | Production build                     |
| `pnpm typecheck` | TypeScript check (`tsc --noEmit`)    |
| `pnpm lint`      | ESLint                               |
| `pnpm format`    | Prettier over all `.ts`/`.tsx` files |

## How it works

The app has no database and a single API route:

```
app/api/agent/route.ts   POST endpoint — runs the agent, streams SSE events
app/page.tsx             The agent console page
components/
  agent-console.tsx      Instructions input, live run view, file downloads
  mcp-server-panel.tsx   Add/remove/toggle remote MCP servers
  markdown.tsx           Streaming markdown renderer
hooks/
  use-agent-stream.ts    Consumes the SSE stream into UI state
  use-mcp-servers.ts     Client-side MCP server list
lib/
  agent-events.ts        Shared event types + tool labels
  mcp.ts                 MCP server input validation & transport inference
```

A run flows like this:

1. The client `POST`s instructions (and any MCP servers) to `/api/agent`.
2. The route spins up a fresh temp directory and starts a Claude Agent SDK `query` with a restricted toolset — read-only tools are pre-approved, `Write`/`Edit` are only allowed inside the run directory, everything else is denied.
3. SDK messages are translated into a small set of SSE events (`init`, `text`, `tool_start`, `tool_end`, `file`, `verdict`, `done`, `error`) that the console renders live.
4. On success, a separate structured-output call to the Claude API grades the run, files in the run directory (up to 5 MB each, 20 MB total) are sent down as base64 downloads, and the temp directory is removed.

## Tech stack

- **Framework:** Next.js 16 (App Router) + React 19
- **Agent:** `@anthropic-ai/claude-agent-sdk` (agent runs) + `@anthropic-ai/sdk` (evaluation)
- **UI:** Tailwind CSS v4, shadcn/ui, Radix UI, lucide-react
- **Markdown:** react-markdown + remark-gfm
