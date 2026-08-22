# Wireframe mode always uses the skill's own shipped token scale, never auto-detects a project's

Wireframe mode needed a token source. The tempting option was having the skill look for a project's
own design tokens (Tailwind config, Style Dictionary JSON, raw CSS custom properties, SCSS
variables) and reuse them for higher-fidelity proportion. But there's no single convention for where
those live or what shape they take, so detecting them reliably is itself a research task — directly
against the "lightweight on inference" constraint this skill is built around, and prone to silently
picking the wrong file or values.

Decided wireframe mode always uses the skill's own shipped, portable semantic token scale. It only
ever uses a project's real tokens if the user hands them over explicitly (points at a file, pastes
values) — never by inspecting the target repo on its own.

## Considered options

- **Auto-detect project tokens when present** — rejected. Turns every sketch into a small discovery
  task, works against a core cost constraint, and risks wrong guesses on non-obvious token layouts.
