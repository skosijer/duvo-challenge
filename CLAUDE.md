# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context

Take-home coding challenge — prioritize polish and demo-readiness over long-term infrastructure. Frontend-only Next.js app, no backend or database. Commit directly to `main`.

## This is NOT the Next.js you know

Next.js 16 has breaking changes — APIs, conventions, and file structure may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code. Heed deprecation notices.

## Commands

Use **pnpm**, not npm.

- `pnpm dev` — dev server
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm lint` — ESLint
- `pnpm format` — Prettier over all `.ts`/`.tsx`

After making code changes, verify with `pnpm typecheck` and `pnpm lint`. There is no test framework.

## UI conventions

- Add shadcn/ui components with `pnpm dlx shadcn@latest add <name>` (see `/add-component` skill); they land in `components/ui/`. Don't hand-write components shadcn provides.
- Tailwind CSS v4 with CSS-variable theming defined in `app/globals.css`. Merge classes with `cn()` from `lib/utils.ts`.
- Imports use the `@/` path alias (e.g., `@/components/ui/button`).

## Gotchas

- Pressing `d` anywhere in the app toggles dark mode (`components/theme-provider.tsx`) — keep in mind when adding keyboard handlers or testing the UI.
