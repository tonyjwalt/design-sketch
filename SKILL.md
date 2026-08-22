---
name: design-sketch
description: Generate lightweight single-file HTML/CSS sketches to visualize proposals and design ideas, with optional wireframe, tuner-panel, and ID-reference modes. Sketches move from disposable exploration through tuning to a baked production-reference file. Use when the user wants to sketch, visualize, draw a concept, wireframe a layout, or says "sketch this".
---

# Design Sketch

Lightweight HTML sketches that visualize ideas fast. Every cycle ends with an HTML file — exactly
one, self-contained, at every stage of the lifecycle below. No exceptions (see `docs/adr/0001`).
"Self-contained" means one *file* — an exploration or tuned sketch legitimately carries more than
one `<style>`/`<script>` tag (its own, plus one contiguous block per active mode from Step 4.9/5.2).
Only the reference stage, after baking strips those blocks, is guaranteed down to at most the
sketch's own `<style>`/`<script>` — a sketch that never authored its own `<script>` may have none.

## Sketch lifecycle

1. **Exploration** — disposable, cheap, one of several while approaching a design.
2. **Tuned** — an exploration sketch with a tuner panel added (Step 5) to hone a value or variant live.
3. **Reference** — the sketch a design converges on. Tuner values baked into static CSS, tuner panel
   and ID overlay removed (Step 6). Handed off as the source of truth for production.

## Workflow

### 1. Establish output location

First sketch in a session: ask where to save files. Remember for subsequent sketches.

### 2. Resolve ambiguity

Before producing HTML, resolve unknowns with the cheapest tool:

1. **Ask** — if a question gets the answer, ask it
2. **ASCII sketch** — if showing is faster than explaining, sketch inline in a fenced ` ```text `
   block (plain response text isn't guaranteed monospace; a fence is, and alignment depends on it)
3. **HTML sketch** — only when fidelity matters (layout, color, proportion)

Spend the minimum effort to know what to draw. Break large ambiguous areas into smaller focused
sketches rather than asking many questions.

### 3. Pick a fidelity mode

- **Styled** (default) — realistic content, real color decisions.
- **Wireframe** — layout/proportion matters more than visual polish. Load
  `templates/wireframe-tokens.css` and inline its custom properties into the sketch's `:root`.
  Always the skill's own shipped scale — never inspect the target project for its own tokens
  (`docs/adr/0003`).

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
9. **ID overlay by default** — load `templates/id-overlay.html` and inline its style+script block
   into every exploration or tuned sketch, unless told not to (`docs/adr/0004`). Never in a
   reference sketch — baked out in Step 6.

Name files descriptively: `sketch-<subject>.html`

### 5. Add tuners — only when asked

1. Load `references/tuner-conventions.md` for the element-per-value-type mapping
2. Load `templates/tuner-panel.html` and inline its markup, style, and script as one block
3. Bind controls only via the `data-bind`/`data-target` attributes the template defines — never
   author one-off JS per control. `data-target` means different things depending on `data-bind`:
   a CSS custom property name for `css-var`, a CSS selector for `class-toggle` — see
   `templates/tuner-panel.html`'s own examples of both before wiring a new control.
4. Give a continuous control a readout via `data-readout="someId"` (bare id, no `#`) plus a matching
   `<output id="someId">` — the template's generic listener updates it via `getElementById`; don't
   hand-write a readout binding
5. What gets tuned is a per-sketch human decision; don't infer it
6. Edit the sketch **in place** — adding tuners doesn't fork a new file. The exploration → tuned →
   reference lifecycle is one file evolving through stages; the only fork happens at bake (Step 6)

This moves the sketch from exploration to **tuned**.

### 6. Bake — only when asked

1. Read the current value of each tuner control
2. For a `css-var` tuner, replace the CSS custom property's `:root` declaration with its current
   value, as a plain static value
3. For a `class-toggle` tuner, hardcode the current class directly onto the target element in the
   markup and leave the class-gated CSS rule as-is — don't flatten the rule into the base ruleset
4. Delete the tuner panel block and the ID overlay block entirely (markup, style, and script for
   both)
5. Save as a new file named `<tuned-sketch-name>-reference.html` — don't overwrite the tuned sketch,
   so the exploration history survives

This moves the sketch from tuned to **reference** (`docs/adr/0002`).

### 7. Iterate

User reacts. Use the effort ladder again (ask → ASCII) to resolve what changed, then produce the
next sketch.

## Files

| File | When to load |
|------|-------------|
| `templates/wireframe-tokens.css` | Step 3, wireframe mode |
| `templates/id-overlay.html` | Step 4, every exploration/tuned sketch (default) |
| `references/tuner-conventions.md` | Step 5, before adding a tuner panel |
| `templates/tuner-panel.html` | Step 5, adding tuners |
