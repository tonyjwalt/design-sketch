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

## Follow-up: mechanizing the explicit hand-off

The "user hands them over explicitly" path is now mechanized: `sketch-tool create --tokens <file>`
merges any file already shaped as CSS custom-property declarations into the sketch's `:root`, using
the same merge-without-duplicating logic `--type wireframe` uses for the shipped scale. `--tokens`
and `--type wireframe` are mutually exclusive — both target `:root`, so only one source can apply.

This only mechanizes the merge step, not detection or translation. If the user's tokens arrive in a
non-CSS-variable format (Tailwind config, SCSS variables, Style Dictionary JSON), translating them to
`:root` custom properties is still agent-driven — that's the actual research/judgment task this ADR
rejected automating, not the string-splicing merge itself.

## Follow-up: wireframe -> real tokens is a two-pass operation

Merging real tokens alongside the wireframe scale doesn't get a sketch off wireframe mode — the
wireframe `--wf-*` properties are additive, not replaced, and nothing rewires the sketch's own rules
to use the new names. Moving a wireframe sketch onto real tokens (SKILL.md Step 3.5) is a distinct
two-pass operation: an agent-proposed, human-confirmed mapping table (`--wf-x` -> real token, one
entry per `--wf-*` property actually used in the sketch, since the wireframe and real scales rarely
line up 1:1), then a mechanical rewrite via `sketch-tool rebrand --map '<json>'` that renames the
`var(--wf-x)` usages per the confirmed table and deletes the `--wf-*` declarations from `:root`.
Same split as the merge: the mapping decision is agent/human judgment, the string-level rename is
mechanized.
