---
name: design-sketch
description: Generate lightweight single-file HTML/CSS sketches to visualize proposals and design ideas, with optional wireframe, tuner-panel, and ID-reference modes. Sketches move from disposable exploration through tuning to a baked production-reference file. Use when the user wants to sketch, visualize, draw a concept, wireframe a layout, or says "sketch this".
---

# Design Sketch

Lightweight HTML sketches that visualize ideas fast. Most requests should resolve entirely in
plain-text ASCII (Step 2) — HTML is a deliberate escalation, not the default deliverable. When a
sketch does get built, every cycle ends with an HTML file — exactly one, self-contained, at every
stage of the lifecycle below. No exceptions (see `docs/adr/0001`).
"Self-contained" means one *file* — an exploration or tuned sketch legitimately carries more than
one `<style>`/`<script>` tag (its own, plus one contiguous block per active mode from Step 4.9/5.2).
Only the reference stage, after baking strips those blocks, is guaranteed down to at most the
sketch's own `<style>`/`<script>` — a sketch that never authored its own `<script>` may have none.

## Sketch lifecycle

1. **Exploration** — disposable, cheap, one of several while approaching a design. Preserved
   untouched once tuning starts — Step 5 forks a copy rather than editing it.
2. **Tuned** — a copy of the exploration sketch with a tuner panel added (Step 5) to hone a value or
   variant live. Becomes the live file further iteration (Step 7) continues on.
3. **Reference** — the sketch a design converges on. Tuner values baked into static CSS, tuner panel
   and ID overlay removed (Step 6). Handed off as the source of truth for production.

## Workflow

### 1. Establish output location

First sketch in a session: ask where to save files. Remember for subsequent sketches.

### 2. Resolve — the default deliverable, not a preamble

Ask and ASCII aren't a courtesy before the real answer — for most requests, they ARE the answer.
**Do not produce HTML until the user asks for it directly.** Approving a direction, picking a
favorite among options, or reacting positively is not the same as asking for HTML — wait for an
explicit request (e.g. "draw this in HTML," "make this real"). If a request is suggestive but
doesn't clearly ask for HTML (e.g. "formalize this," "hand it to the dev") — ask which they want
rather than inferring it.

1. **Ask** — if a question gets the answer, ask it.
2. **ASCII sketch** — the default response, almost always. Skip it only when the
   request is so specific there's genuinely one thing to draw and nothing to resolve.
   - One clear interpretation → sketch it once, in a fenced ` ```text ` block (plain response text
     isn't guaranteed monospace; a fence is, and alignment depends on it).
   - Multiple plausible directions → sketch 2-3 options side by side, each labeled, with a stated
     recommendation and why.
3. **Iterate here** — refine the options in ASCII as feedback comes in. Most requests should
   resolve entirely in this loop, never touching HTML at all.
4. **Escalate to HTML** — only on an explicit request. Move to Step 3.

### 3. Pick a fidelity mode

- **Styled** (default) — realistic content, real color decisions.
- **Wireframe** — layout/proportion matters more than visual polish. Always the skill's own shipped
  scale (`templates/wireframe-tokens.css`) — never inspect the target project for its own tokens
  (`docs/adr/0003`). The custom properties get merged into the sketch's `:root` at Step 4.9, via
  `sketch-tool create --type wireframe`.

### 4. Produce the sketch

1. **Semantic HTML** — `<main>`, `<nav>`, `<header>`, `<section>`, `<aside>` over generic divs
2. **Semantic IDs** — meaningful IDs on elements that represent concepts, so they can be referenced
   in feedback
3. **Minimal DOM** — fewest nodes that convey the idea
4. **Flexbox layout** — primary layout mechanism
5. **CSS custom properties** — repeated values as custom properties in `:root`
6. **Style block in `<head>`** — a single `<style>` element for the sketch's own styling, no inline
   styles. Exception: positional values (left, width, top) computed at runtime. Template blocks
   inlined by Step 4.9 or Step 5.2 keep their own separate, contiguous `<style>`/`<script>` — don't
   merge their rules into this one.
7. **No frameworks or external dependencies** — no Tailwind, Bootstrap, CDN links
8. **Self-contained single file** — one `.html` file, no separate assets, at every lifecycle stage
9. **ID overlay by default, plus wireframe tokens if Step 3 chose wireframe** — once the sketch's
   own markup and `<style>` exist, run:

   ```
   node tools/sketch-tool.js create <file> [--type wireframe|styled] [--no-overlay]
   ```

   This injects the `templates/id-overlay.html` style+script block as one contiguous block, unless
   told not to (`docs/adr/0004` — use `--no-overlay`), and, when `--type wireframe` matches Step 3's
   choice, merges `templates/wireframe-tokens.css`'s custom properties into the sketch's existing
   `:root` (creating one if none exists yet) without duplicating anything already there. `--type
   styled` or omitting `--type` injects the overlay only — no tokens, matching styled as the default
   fidelity mode. Safe to re-run against the same file — neither block gets duplicated. Never run
   against a reference sketch — both blocks are baked out in Step 6.

   **If Node isn't available**, fall back to the manual procedure: load `templates/id-overlay.html`
   and inline its style+script block as one contiguous block into the sketch, wrapped in
   `<!-- design-sketch:id-overlay -->` / `<!-- /design-sketch:id-overlay -->` comments — the same
   markers `sketch-tool create` writes and checks for, so a later tool invocation against this file
   recognizes the overlay is already there instead of duplicating it. Unless told not to. For
   wireframe mode, load `templates/wireframe-tokens.css` and inline its custom properties into the
   sketch's `:root` (merging by hand into an existing `:root` if one is already there, not
   duplicating declarations).

Name files descriptively: `sketch-<subject>.html`

### 5. Add tuners — only when asked

1. Load `references/tuner-conventions.md` for the element-per-value-type mapping — this decides
   `--type` and whether a `css-var` control is continuous or a swatch; what gets tuned is a
   per-sketch human decision, don't infer it
2. Run:

   ```
   node tools/sketch-tool.js tune <file> --type css-var|class-toggle --target <name-or-selector> \
     --label <text> [--options a,b,c] [--min N --max N] [--value V] [--unit STR] [--readout] [--prefix STR]
   ```

   The command is smart about `<file>`'s state: run against the exploration sketch (no panel yet),
   it forks a copy to `<subject>-tuned.html` and injects a working tuner-panel skeleton with this one
   control — don't edit the exploration file in place (`docs/adr/0006`); the fork keeps the clean
   version demoable and becomes the live file iteration continues on (Step 7). Run again against that
   same tuned file, it appends the new control to the existing panel instead of duplicating the
   `<fieldset>`, style, or script. `--type css-var` takes either `--min`/`--max` (continuous, with
   optional `--value`/`--unit`) or `--options` (swatch buttons) — never both. `--type class-toggle`
   takes `--options` (variant names for a `<select>`) and treats `--target` as a CSS **selector**, not
   a custom property name. `--readout` wires a continuous control's live numeric readout
   (`data-readout` plus a matching `<output>`) automatically — never hand-write that binding.
   Controls are bound only via the `data-bind`/`data-target` attributes the template defines; see
   `templates/tuner-panel.html`'s own examples of both bind types before wiring one by hand.

   **If Node isn't available**, fall back to the manual procedure: copy the exploration sketch to
   `<subject>-tuned.html` first (don't edit the exploration file in place). Load
   `templates/tuner-panel.html` and inline its markup, style, and script as one contiguous block,
   wrapped in `<!-- design-sketch:tuner-panel -->` / `<!-- /design-sketch:tuner-panel -->` comments —
   the same markers `sketch-tool tune` writes and checks for, so a later tool invocation against this
   file recognizes the panel is already there and appends instead of duplicating it. Bind each control
   by hand via `data-bind`/`data-target` only, remembering `data-target` means different things per
   `data-bind` (a CSS custom property name for `css-var`, a CSS selector for `class-toggle`), and wire
   a continuous control's readout via `data-readout="someId"` (bare id, no `#`) plus a matching
   `<output id="someId">` rather than hand-writing a readout binding.

This moves the sketch from exploration to **tuned**.

### 6. Bake — only when asked

1. Read the current value of each tuner control
2. For a `css-var` tuner, replace the CSS custom property's `:root` declaration with its current
   value, as a plain static value
3. For a `class-toggle` tuner, hardcode the current class directly onto the target element in the
   markup and leave the class-gated CSS rule as-is — don't flatten the rule into the base ruleset
4. Delete the tuner panel block and the ID overlay block entirely (markup, style, and script for
   both)
5. Save as a new file named `<subject>-reference.html` — anchored to the original subject, not
   chained onto the tuned file's name (`-tuned-reference` reads worse). Don't overwrite the tuned
   sketch, so the tuning history survives

This moves the sketch from tuned to **reference** (`docs/adr/0002`).

### 7. Iterate

User reacts. Use the effort ladder again (ask → ASCII) to resolve what changed, then update the
current live file — the tuned sketch once one exists (Step 5), otherwise the exploration sketch.

## Files

| File | When to load |
|------|-------------|
| `templates/wireframe-tokens.css` | Step 3, wireframe mode |
| `templates/id-overlay.html` | Step 4, every exploration/tuned sketch (default) |
| `tools/sketch-tool.js` | Step 4.9, mechanizes overlay + wireframe-token injection; Step 5, mechanizes tuner-panel fork/inject/append (Node) |
| `references/tuner-conventions.md` | Step 5, before adding a tuner panel |
| `templates/tuner-panel.html` | Step 5, adding tuners |
