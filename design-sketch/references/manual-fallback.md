# Manual fallback (no Node available)

Use only when `node tools/sketch-tool.js ...` cannot run. Each procedure below produces the same
result the tool would, by hand.

## create (Step 4.9)

Load `templates/id-overlay.html` and inline its style+script block as one contiguous block into the
sketch, wrapped in `<!-- design-sketch:id-overlay -->` / `<!-- /design-sketch:id-overlay -->`
comments — the same markers `sketch-tool create` writes and checks for, so a later tool invocation
against this file recognizes the overlay is already there instead of duplicating it. Unless told not
to. For wireframe mode, load `templates/wireframe-tokens.css` and inline its custom properties into
the sketch's `:root` (merging by hand into an existing `:root` if one is already there, not
duplicating declarations).

## rebrand (Step 3.5)

Once the mapping table is confirmed with the human (SKILL.md Step 3.5's mapping pass — do this part
regardless of Node availability), apply it by hand:

1. For each `--wf-x` -> `--target-y` entry in the confirmed table, find every `var(--wf-x` occurrence
   in the sketch's rules and change the property name to `--target-y`, leaving any fallback argument
   (`var(--wf-x, 8px)` -> `var(--target-y, 8px)`) untouched.
2. Delete every `--wf-*: ...;` declaration from `:root` (and the
   `/* wireframe tokens (design-sketch) */` comment above them), leaving every other declaration in
   `:root` untouched.
3. Don't touch HTML/DOM — this operation is scoped to `:root` declarations and `var()` usages only.

## tune (Step 5)

Copy the exploration sketch to `<same-basename>-tuned.html` first (don't edit the exploration file in
place — e.g. `sketch-foo.html` -> `sketch-foo-tuned.html`). Load `templates/tuner-panel.html` and
inline its markup, style, and script as one contiguous block, wrapped in
`<!-- design-sketch:tuner-panel -->` / `<!-- /design-sketch:tuner-panel -->` comments — the same
markers `sketch-tool tune` writes and checks for, so a later tool invocation against this file
recognizes the panel is already there and appends instead of duplicating it. Bind each control by
hand via `data-bind`/`data-target` only, remembering `data-target` means different things per
`data-bind` (a CSS custom property name for `css-var`, a CSS selector for `class-toggle`), and wire a
continuous control's readout via `data-readout="someId"` (bare id, no `#`) plus a matching
`<output id="someId">` rather than hand-writing a readout binding.

## bake (Step 6)

1. Read the current value of each tuner control (ask the human, per Step 6.1)
2. For a `css-var` tuner, replace the CSS custom property's `:root` declaration with its current
   value, as a plain static value
3. For a `class-toggle` tuner, hardcode the current class directly onto the target element in the
   markup and leave the class-gated CSS rule as-is — don't flatten the rule into the base ruleset
4. Delete the tuner panel block and the ID overlay block entirely (markup, style, and script for
   both)
5. Save as a new file anchored to the original subject, never chained onto the tuned filename — e.g.
   `sketch-foo-tuned.html` -> `sketch-foo-reference.html`, not `sketch-foo-tuned-reference.html`.
   Don't overwrite the tuned sketch, so the tuning history survives
