---
applyTo: "src/**/*.tsx,src/**/*.ts,**/*.css"
---
# Design System Universal Rules

> Cross-repo design system rules applying to all managed repositories.

## Token Rules (ALL repos)

- ⛔ NEVER hardcode hex colors (`#RRGGBB`) in components — use CSS variables or Tailwind tokens
- ⛔ NEVER hardcode rgb/rgba/hsl/hsla in TSX files
- ⛔ NEVER use Tailwind arbitrary colors (`bg-[#xxx]`) — define a token instead
- ⛔ NEVER use inline `style={{ color: ... }}` with literal values
- ✅ ALWAYS use semantic tokens: `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`
- ✅ ALWAYS use `cn()` utility for conditional class names (not template literals)

## Typography (ALL repos)

- ✅ Headings: use the designated heading font class (`font-heading`, `font-serif`, etc.)
- ✅ Body: use the designated body font class (`font-body`, `font-sans`, etc.)
- ⛔ NEVER hardcode `fontFamily` in inline styles

## Spacing (ALL repos)

- ✅ Use Tailwind spacing scale (p-4, gap-6, py-16, etc.)
- ⛔ NEVER use arbitrary spacing (`p-[13px]`) unless documented exception

## Animation (ALL repos)

- ✅ ALWAYS check `useReducedMotion()` when using Framer Motion
- ✅ ALWAYS import animation constants from the repo's shared config
- ⛔ NEVER animate width, height, top, left — only transform and opacity

## Accessibility (ALL repos)

- ✅ All images: `alt` text required
- ✅ All buttons: accessible name (text content or `aria-label`)
- ✅ All interactive elements: visible focus ring (`focus-visible:ring-2`)
- ⛔ NEVER use `<div onClick>` without `role="button" tabIndex={0} onKeyDown`

## Responsive (ALL repos)

- ✅ Mobile-first: base classes are mobile, `sm:`/`md:`/`lg:` add desktop
- ✅ Touch targets: minimum 44x44px on interactive elements
- ⛔ NEVER use fixed pixel widths without responsive fallback
