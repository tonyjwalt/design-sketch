---
name: design-sketch
description: Generate lightweight single-file HTML/CSS sketches to visualize proposals and design ideas, with optional wireframe, tuner-panel, and ID-reference modes. Sketches move from disposable exploration through tuning to a baked production-reference file. Use when the user wants to sketch, visualize, draw a concept, wireframe a layout, or says "sketch this".
metadata:
  version: "1.0.0"
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
   and ID overlay removed (Step 6). Handed off as the source of truth for production. Terminal, not
   editable in place — further feedback forks a new exploration sketch (Step 7, `docs/adr/0006`).

A wireframe sketch (exploration or tuned, not reference) can additionally move onto real tokens
in place, without changing lifecycle stage — see Step 3.5.

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

If the user hands over their own token set explicitly (points at a file, pastes values) — never by
inspecting the target repo on your own (`docs/adr/0003`) — merge those instead, via
`sketch-tool create --tokens <css-file>` at Step 4.9. `--tokens` and `--type wireframe` are mutually
exclusive: both merge a token `:root` into the sketch, so only one source applies. If the user's
tokens aren't already CSS custom properties (a Tailwind config, SCSS variables, a Style Dictionary
JSON), translate them to a `:root { --name: value; }` block yourself first — that translation is a
judgment call the tool can't automate — then point `--tokens` at the translated file for the actual
merge.

### 3.5 Rebrand — moving a wireframe sketch onto real tokens, only when asked

Only applies to a wireframe sketch that already exists (Step 3 chose wireframe, `--wf-*` tokens are
in `:root`). Going from wireframe to real tokens changes what every value *means*, not just where it
comes from — the wireframe scale and the user's tokens rarely line up 1:1 (different step counts,
missing roles, different granularity), so this is a two-pass operation, not a single command:

1. **Mapping pass — propose, don't write.** Find every `--wf-*` property actually referenced via
   `var(...)` in the sketch's own rules (not the full shipped scale — most of it was never used).
   For each one, propose the closest real token by role (spacing step, text color, line color,
   radius, etc. — `references/tuner-conventions.md`'s role vocabulary applies here too). Present it
   as an ASCII table, same escalation discipline as Step 2, and call out anything that doesn't map
   cleanly instead of guessing:
   - **Several wireframe steps collapsing onto one real token** (coarser real scale) — note it, don't
     hide it.
   - **No real equivalent exists** for a wireframe role — flag it as a decision for the human, not
     something to invent a value for.

   Get the table confirmed (or corrected) before touching the file.

2. **Rewrite pass — mechanical, only after the table's confirmed.** First make sure the target tokens
   are already merged into `:root` (Step 4.9, `create --tokens <file>`). Then run
   `node tools/sketch-tool.js rebrand --help` for exact flags, then invoke `rebrand` with the
   confirmed table as `--map`. It refuses to run — writing nothing — if any `--wf-*` property actually
   used in the file is missing from `--map`, or if any mapped-to target isn't already declared in
   `:root`. Scoped strictly to renaming `var(--wf-x)` usages and deleting the `--wf-*` declarations
   from `:root` — it never touches HTML/DOM, matching the point of doing this in place rather than
   forking a new sketch.

   **If Node isn't available**, do the same two operations by hand: rewrite each `var(--wf-x)` usage
   to the mapped token (preserving any fallback argument), then delete the `--wf-*` declarations
   (and the `/* wireframe tokens (design-sketch) */` comment above them) from `:root` entirely.

### 4. Produce the sketch

Author a full HTML document from the start — `<!DOCTYPE html>`, `<html>`, `<head>`, `<body>` —
never a bare fragment.

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
   own markup and `<style>` exist, run `node tools/sketch-tool.js create --help` for exact flags,
   then invoke `create` accordingly. Safe to re-run against the same file — neither block gets
   duplicated. Refuses to run against a reference sketch — both blocks are baked out in Step 6, and a
   reference sketch is a handoff artifact, not something to reopen (Step 7, `docs/adr/0006`).

   **If Node isn't available**, fall back to `references/manual-fallback.md`.

Name files descriptively: `sketch-<subject>.html`

### 5. Add tuners — only when asked

1. Load `references/tuner-conventions.md` for the element-per-value-type mapping — this decides
   `--shape`; what gets tuned is a per-sketch human decision, don't infer it
2. Run `node tools/sketch-tool.js tune --help` for exact flags/semantics per `--shape`, then invoke
   `tune` accordingly. Key behaviors worth knowing before you read `--help`:
   - First `tune` against an exploration sketch (no panel yet) forks a copy to
     `<same-basename>-tuned.html` (e.g. `sketch-foo.html` -> `sketch-foo-tuned.html`) and injects a
     tuner-panel skeleton — don't edit the exploration file in place (`docs/adr/0006`); the fork keeps
     the clean version demoable and becomes the live file iteration continues on (Step 7). Later
     `tune` calls against that same tuned file append in place instead of forking again.
   - The binding (`css-var` vs `class-toggle`) isn't a separate flag — it's derived from `--target`'s
     own syntax: a custom-property name always starts with `--`, a CSS selector never does. `--shape`
     and `--target` must agree, or the command errors before writing anything.
   - `--remove <target>` and `--edit <old-target> --shape ... --target ... --label ...` change an
     already-tuned file's controls in place — never hand-edit the panel markup.

   **If Node isn't available**, fall back to `references/manual-fallback.md`.

This moves the sketch from exploration to **tuned**.

### 6. Bake — only when asked

1. **Ask before assuming nothing changed.** A tuner's *current* value only exists in live browser
   DOM state — the static file's `value`/`selected` attributes are its authored defaults, not
   necessarily where the human left it. Before calling the tool, ask: "baking at current defaults,
   or did you land on something different for any of these?" Passing an empty/sparse `--values`
   is only safe once the human has confirmed which controls (if any) moved — never assume silently.
2. Run `node tools/sketch-tool.js bake --help` for exact flags, then invoke `bake` accordingly.
   Forks to `<same-basename>-reference.html` — anchored to the original subject, not chained onto the
   tuned file's name (e.g. `sketch-foo-tuned.html` -> `sketch-foo-reference.html`, never
   `sketch-foo-tuned-reference.html`). Never overwrites the tuned sketch, so the tuning history
   survives. Deletes the tuner-panel and ID-overlay blocks entirely (markup, style, and script for
   both).

   **If Node isn't available**, fall back to `references/manual-fallback.md`.

This moves the sketch from tuned to **reference** (`docs/adr/0002`).

### 7. Iterate

User reacts. Use the effort ladder again (ask → ASCII) to resolve what changed, then update the
current live file — the tuned sketch once one exists (Step 5), otherwise the exploration sketch.

**If the current live file is a reference sketch**, don't edit it in place. Baking closed the design
question (`docs/adr/0002`); a reference sketch is a handoff artifact, not a working file. Instead,
fork a new exploration sketch seeded from the reference's markup and restart the lifecycle at Step 1
— name it descriptively per Step 4, same as any new sketch (don't mechanically chain onto
`-reference`; scope may have shifted enough that a fresh subject name fits better). `sketch-tool.js
create` refuses to run against a `-reference.html` file for the same reason (`docs/adr/0006`).

## Files

| File | When to load |
|------|-------------|
| `templates/wireframe-tokens.css` | Step 3, wireframe mode |
| `templates/id-overlay.html` | Step 4, every exploration/tuned sketch (default) |
| `tools/sketch-tool.js` | Step 4.9, mechanizes overlay + wireframe-token injection; Step 5, mechanizes tuner-panel fork/inject/append; Step 6, mechanizes bake's fork-substitute-strip (Node) |
| `references/tuner-conventions.md` | Step 5, before adding a tuner panel |
| `templates/tuner-panel.html` | Step 5, adding tuners |
| `references/manual-fallback.md` | Steps 3.5/4.9/5/6, only if Node isn't available |
