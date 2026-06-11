import { Asterisk } from "lucide-react"

import { AgentConsole } from "@/components/agent-console"

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <div className="flex items-center gap-1.5">
          <Asterisk className="size-5 text-primary" strokeWidth={2.5} />
          <span className="font-serif text-base font-semibold tracking-tight">
            Agent Console
          </span>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          (Press <kbd>d</kbd> to toggle dark mode)
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pt-12 pb-24 sm:pt-20">
        <h1 className="font-serif text-4xl leading-tight font-medium tracking-tight text-balance sm:text-[2.75rem]">
          What should the agent <em className="text-primary">do</em> for you?
        </h1>
        <p className="mt-3 mb-8 max-w-prose text-muted-foreground">
          Give it one set of instructions. It can search the web, read pages,
          and save results as files you can download.
        </p>
        <AgentConsole />
      </main>
    </div>
  )
}
