---
name: add-component
description: Add a shadcn/ui component to this project and adapt it to the repo's conventions. Use whenever a UI primitive (button, dialog, card, dropdown, form input, etc.) is needed and doesn't exist in components/ui/ yet.
---

Add the component via the shadcn CLI rather than hand-writing it:

```bash
pnpm dlx shadcn@latest add <component-name>
```

Add several at once when the feature needs them: `pnpm dlx shadcn@latest add dialog form input label`.

This project's registry config (`components.json`): style `radix-nova`, base color `neutral`, CSS variables for theming, lucide-react icons. Components land in `components/ui/` and import `cn` from `@/lib/utils`.

After adding:

1. Check the generated file — this is shadcn v4 with Tailwind v4; variants are defined with `cva` and theme colors come from CSS variables in `app/globals.css` (e.g., `bg-primary`, `text-muted-foreground`). Never hardcode hex colors; extend the variables in `globals.css` if a new color is needed.
2. Customize by editing the generated file directly (that's the shadcn model — the code is yours), but keep the `cva` variant structure and `cn()` class merging so callers can still override classes.
3. Import it via the alias: `import { Button } from "@/components/ui/button"`.
4. Verify with `pnpm typecheck` and `pnpm lint`.

If a needed component isn't in the shadcn registry, build it in `components/` (not `components/ui/`) following the same patterns: `cva` for variants, `cn()` for class merging, CSS-variable colors, lucide icons.
