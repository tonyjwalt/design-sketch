# 04 — `tune` subcommand: fork-and-inject / append

**Priority:** P1 — core value delivery; also the highest-risk hand-edit today (data-bind/
data-target mismatches fail silently per references/tuner-conventions.md).

**What to build:** `sketch-tool tune <file> --type css-var|class-toggle --target ... [--label
--options / --min --max --value --unit --readout]`. The command is smart about file state: run
against an exploration sketch, it forks to `<subject>-tuned.html` and injects the tuner-panel
skeleton with the given control. Run again against that same tuned file, it appends an additional
control to the existing panel instead of duplicating panel markup or script. Replaces the hand
copy-paste currently described in SKILL.md Step 5.

**Blocked by:** None (ADR-0007 is decided and committed at docs/adr/0007-generation-time-cli-mechanizes-boilerplate-steps.md). Independent of 03's output — can be built in parallel.

**Implementation note:** `tools/sketch-tool.js` (built for issue 03) already has reusable block-finding
primitives worth building on rather than reinventing: `matchingBrace`/`findRootBlock` for
brace-balanced parsing, and the marker-comment pattern from `injectIdOverlay` (wrap an injected block
in `<!-- design-sketch:<name> -->` / `<!-- /design-sketch:<name> -->` so a later run can detect it's
already present). `tune`'s fork-vs-append decision is exactly this kind of "does a `.tuner-panel`
block already exist" check.

**Status:** ready-for-agent

- [x] `tune` against an exploration file forks it to `<subject>-tuned.html` and injects a working
      tuner-panel with the specified control (first-call path)
- [x] `tune` against an already-tuned file (one that already carries a panel) appends the new
      control to the existing panel — no duplicate `<fieldset>`/script (subsequent-call path)
- [x] `--type css-var` wires a continuous or swatch control per tuner-conventions.md
- [x] `--type class-toggle` wires a discrete variant control, with `--target` interpreted as a CSS
      selector (not a CSS custom property name) per the conventions doc
- [x] `--readout` wires a continuous control's live numeric readout per convention (no hand-written
      readout binding)
- [x] Tests cover both the first-call (fork + inject) and subsequent-call (append) branches
- [x] SKILL.md Step 5 updated to describe invoking the tool, with the manual fallback procedure
      preserved alongside it for when Node isn't available

## Comments

Implemented as the `tune` subcommand in `tools/sketch-tool.js`. Fork-vs-append is decided by the
same marker-comment pattern `create` uses for id-overlay: `<!-- design-sketch:tuner-panel -->` /
`<!-- /design-sketch:tuner-panel -->` wrap the whole injected block. The panel's `<style>` and
`<script>` are pulled verbatim from `templates/tuner-panel.html` (never vary per control); only the
`<fieldset>` contents are synthesized from CLI flags, so first-call output never carries the
template's own illustrative example controls. Appending a control finds the existing block via the
markers and inserts the new `<label>` immediately before that block's `</fieldset>`, leaving style
and script untouched. Re-running `tune` against the exploration file after a tuned copy already
exists errors instead of silently overwriting the tuned file's accumulated controls — the user is
expected to point subsequent calls at the tuned file directly, per the spec's fork/append framing.
25/25 tests pass (`python3 tests/test_static.py`).
