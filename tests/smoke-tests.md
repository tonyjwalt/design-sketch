# Smoke Tests — design-sketch

## Test S1: Base sketch — trigger and effort ladder

**Input:** "sketch this: a sidebar nav with 5 items"

**Validates:** Core skill activates and behaves like the original — unaffected by the new modes

**Pass criteria:**
- [ ] Asks where to save the file (first-time behavior) or produces an ASCII sketch first
- [ ] Does not produce an HTML file as the very first response
- [ ] Once produced, the HTML is a single self-contained file — no `<link>`/`<script src>` to any
      skill-internal file

**Fail indicators:**
- Produces HTML without resolving ambiguity first
- The output file references `templates/` or `references/` paths at runtime instead of inlining
  their content

---

## Test S2: Wireframe mode uses the shipped scale, never the target project's

**Input:** "sketch a two-column layout with a sidebar and main content, in wireframe mode" (run from
inside a repo that has its own token system, e.g. this portfolio site)

**Validates:** ADR-0003 — wireframe mode never inspects the target project for real tokens

**Pass criteria:**
- [ ] `:root` in the output uses the `--wf-*` variable names from `templates/wireframe-tokens.css`
- [ ] No token names from the surrounding project appear in the output
- [ ] Output is grayscale, using `.wf-box`/`.wf-arrow` conventions where applicable

**Fail indicators:**
- Model reads the target project's real `tokens.css` (or similar) and reuses its values/names
- Wireframe output uses real color values instead of the shipped grayscale scale

---

## Test S3: Tuner panel uses templated binding, not one-off JS

**Input:** "add tuners for the sidebar width and the layout variant" (after S1's sketch exists)

**Validates:** Tuners are wired via the generic `data-bind` mechanism from `templates/tuner-panel.html`,
not authored per-control

**Pass criteria:**
- [ ] `references/tuner-conventions.md` guidance is followed: range input for the continuous value
      (width), select/radio for the discrete value (layout variant)
- [ ] Both controls use `data-bind`/`data-target` attributes; no per-control `addEventListener` was
      hand-written
- [ ] Panel is a single `<fieldset class="tuner-panel">` block, not interleaved with sketch content
- [ ] Sketch is still one file

**Fail indicators:**
- Model writes bespoke JS logic per control instead of reusing the generic delegated listeners
- Panel markup is scattered through the DOM instead of one contiguous block

---

## Test S4: ID overlay is on by default and removable on request

**Input A:** "sketch this: a card with a title, image, and button" (no mention of ID overlay)

**Input B:** "sketch this: a card with a title, image, and button — no ID overlay"

**Validates:** ADR-0004 — overlay is opt-out, not opt-in

**Pass criteria:**
- [ ] Input A's output includes the inlined `templates/id-overlay.html` style+script block
- [ ] Input B's output omits it entirely, without being asked twice

**Fail indicators:**
- Input A omits the overlay (treats it as opt-in)
- Input B still includes it (ignores the explicit opt-out)

---

## Test S5: Bake produces a reference sketch with the panel and overlay stripped

**Input:** "bake this into a reference sketch" (after S3's tuned sketch exists, tuners left at some
non-default values)

**Validates:** ADR-0002 — baking freezes values and removes dev-only affordances

**Pass criteria:**
- [ ] New file is saved (the tuned sketch is not overwritten)
- [ ] The CSS custom properties/classes the tuners controlled now hold static values matching
      wherever the controls were left, not the original defaults
- [ ] `.tuner-panel` markup, its `<style>`, and its `<script>` are entirely absent
- [ ] ID overlay markup, style, and script are entirely absent
- [ ] Sketch is still one self-contained file

**Fail indicators:**
- Tuner panel or ID overlay markup/script survives in the reference sketch
- Baked values don't match where the controls were actually left
- Original tuned sketch is overwritten instead of a new file being created
