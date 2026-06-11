import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"

// react-markdown passes the hast `node` to every component; strip it so it
// doesn't get spread onto DOM elements.
function clean<T extends { node?: unknown }>({ node, ...rest }: T) {
  void node
  return rest
}

export function Markdown({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  return (
    <div className={cn("font-serif text-[1.05rem] leading-relaxed", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => (
            <h1
              className="mt-8 mb-3 font-serif text-2xl font-semibold first:mt-0"
              {...clean(props)}
            />
          ),
          h2: (props) => (
            <h2
              className="mt-7 mb-3 font-serif text-xl font-semibold first:mt-0"
              {...clean(props)}
            />
          ),
          h3: (props) => (
            <h3
              className="mt-6 mb-2 font-serif text-lg font-semibold first:mt-0"
              {...clean(props)}
            />
          ),
          h4: (props) => (
            <h4
              className="mt-5 mb-2 font-serif text-base font-semibold first:mt-0"
              {...clean(props)}
            />
          ),
          p: (props) => (
            <p className="my-3 first:mt-0 last:mb-0" {...clean(props)} />
          ),
          ul: (props) => (
            <ul
              className="my-3 list-disc space-y-1.5 pl-6 marker:text-muted-foreground"
              {...clean(props)}
            />
          ),
          ol: (props) => (
            <ol
              className="my-3 list-decimal space-y-1.5 pl-6 marker:text-muted-foreground"
              {...clean(props)}
            />
          ),
          li: (props) => <li className="pl-1" {...clean(props)} />,
          a: (props) => (
            <a
              className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
              target="_blank"
              rel="noreferrer"
              {...clean(props)}
            />
          ),
          blockquote: (props) => (
            <blockquote
              className="my-4 border-l-2 border-primary/50 pl-4 text-muted-foreground italic"
              {...clean(props)}
            />
          ),
          code: ({ className: codeClassName, ...props }) => (
            <code
              className={cn(
                "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]",
                codeClassName
              )}
              {...clean(props)}
            />
          ),
          pre: (props) => (
            <pre
              className="my-4 overflow-x-auto rounded-lg border bg-muted/60 p-4 font-mono text-sm [&_code]:bg-transparent [&_code]:p-0"
              {...clean(props)}
            />
          ),
          table: (props) => (
            <div className="my-4 overflow-x-auto rounded-lg border">
              <table
                className="w-full border-collapse font-sans text-sm"
                {...clean(props)}
              />
            </div>
          ),
          th: (props) => (
            <th
              className="border-b bg-muted/60 px-3 py-2 text-left font-medium whitespace-nowrap"
              {...clean(props)}
            />
          ),
          td: (props) => (
            <td className="border-b px-3 py-2 align-top" {...clean(props)} />
          ),
          hr: (props) => (
            <hr className="my-6 border-border" {...clean(props)} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
