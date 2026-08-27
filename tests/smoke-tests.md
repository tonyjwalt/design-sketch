# Smoke Tests — design-sketch

## Test S1: Base sketch — the HTML gate holds under a positive-but-non-explicit reaction

**Turn 1 input:** "sketch this: a sidebar nav with 5 items"

**Turn 2 input:** "yeah that looks good" (a positive reaction — NOT an explicit request for HTML)

**Turn 3 input:** "ok, draw this in HTML"

**Validates:** Step 2's hard gate — HTML only on explicit request, not inferred from approval

**Pass criteria:**
- [ ] Turn 1 produces ASCII (or a clarifying question) first — never HTML as the first response
- [ ] Turn 2 does NOT escalate to HTML despite the positive reaction — stays in ASCII/text, or at
      most refines the ASCII sketch
- [ ] Turn 3's explicit request is what actually triggers HTML production
- [ ] Once produced, the HTML is a single self-contained file — no `<link>`/`<script src>` to any
      skill-internal file

**Fail indicators:**
- Produces HTML at Turn 1 or Turn 2
- Treats "looks good" as sufficient license to build HTML
- The output file references `templates/` or `references/` paths at runtime instead of inlining
  their content

---

## Test S1b: Ambiguous request gets multi-option ASCII with a recommendation

**Input:** "sketch a dashboard" (genuinely ambiguous — no layout implied)

**Validates:** Step 2.2 — real ambiguity gets 2-3 labeled options plus a stated recommendation, not
a single guess

**Pass criteria:**
- [ ] Response is ASCII, not HTML
- [ ] At least 2 distinct labeled options are shown
- [ ] A recommendation is stated, with a reason

**Fail indicators:**
- Produces a single ASCII sketch with no alternatives despite genuine ambiguity
- Produces HTML directly
- Asks more than 2-3 clarifying questions instead of just showing options

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

## Test S3: Tuner panel forks a copy and uses templated binding, not one-off JS

**Input:** "add tuners for the sidebar width, the layout variant, and the accent color — no palette
exists yet for the accent color" (after S1's sketch exists)

**Validates:** ADR-0006 (fork, don't edit in place) and that all three tuner shapes (continuous,
discrete, color) wire through the generic `data-bind` mechanism in `templates/tuner-panel.html`, not
authored per-control

**Pass criteria:**
- [ ] A new file is created (`<subject>-tuned.html`); S1's original sketch is byte-for-byte untouched
- [ ] `references/tuner-conventions.md` guidance is followed: range input for the continuous value
      (width) with a `data-readout`-wired `<output>`, select/radio for the discrete value (layout
      variant), `<input type="color">` for the accent (no palette exists yet, per the input)
- [ ] All three controls, including the color input, are produced via `sketch-tool.js tune`
      (`--type css-var` with neither `--min`/`--max` nor `--options` scaffolds the color input) —
      not hand-authored panel markup
- [ ] All controls use `data-bind`/`data-target` attributes; no per-control `addEventListener` was
      hand-written
- [ ] Panel is a single `<details class="tuner-panel">` block, not interleaved with sketch content
- [ ] Tuned file is still one self-contained file

**Fail indicators:**
- Original exploration sketch is modified instead of copied
- Model writes bespoke JS logic per control instead of reusing the generic delegated listeners
- Model uses swatch buttons for the accent color despite the input saying no palette exists yet
- Model hand-authors the color-input control's markup instead of running `sketch-tool.js tune`
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

**Validates:** ADR-0002 (baking freezes values and removes dev-only affordances) and ADR-0006's
naming rule (reference file is named off the original subject, not chained onto `-tuned`)

**Pass criteria:**
- [ ] New file is saved as `<subject>-reference.html` (anchored to the original subject, not
      `<subject>-tuned-reference.html`); the tuned sketch is not overwritten
- [ ] The CSS custom properties/classes the tuners controlled now hold static values matching
      wherever the controls were left, not the original defaults
- [ ] `.tuner-panel` markup, its `<style>`, and its `<script>` are entirely absent
- [ ] ID overlay markup, style, and script are entirely absent
- [ ] Sketch is still one self-contained file

**Fail indicators:**
- Tuner panel or ID overlay markup/script survives in the reference sketch
- Baked values don't match where the controls were actually left
- Original tuned sketch is overwritten instead of a new file being created

---

## Test S6: Feedback on a reference sketch forks a new exploration, not an in-place edit

**Input:** "actually, can we make the sidebar wider" (after S5's reference sketch exists, no tuned or
exploration file mentioned)

**Validates:** ADR-0006 — a reference sketch is terminal; iteration restarts the lifecycle rather
than reopening the handoff artifact

**Pass criteria:**
- [ ] A new file is created for the fresh exploration; the reference sketch is byte-for-byte
      untouched
- [ ] The new file is named descriptively per Step 4 (not `<subject>-reference-tuned.html` or
      similar mechanical chaining)
- [ ] The new file starts from the reference sketch's markup, not from scratch or from the earlier
      tuned/exploration files
- [ ] If the model reaches for `sketch-tool.js create` against the reference file by mistake, it
      refuses with an error rather than silently reinjecting the ID overlay

**Fail indicators:**
- Reference sketch is edited in place, or regains a tuner panel / ID overlay
- New exploration is named by mechanically appending to `-reference`
- Model restarts from a blank sketch instead of the reference's markup
