# 05 — `bake` subcommand: fork-and-strip to reference

**Priority:** P1 — highest-stakes mechanical step today: bake is "one-way in practice" per
CONTEXT.md, and getting the strip wrong is exactly what tests/smoke-tests.md Test S4 already
checks for.

**What to build:** `sketch-tool bake <tuned-file> --values '<json>'` forks the tuned sketch to
`<subject>-reference.html`, substitutes the given values into the relevant `:root` custom
properties and/or hardcodes the given classes onto their target elements, and deletes the
tuner-panel and id-overlay blocks (markup, style, and script for both) entirely. Replaces the hand
copy-paste currently described in SKILL.md Step 6.

**Blocked by:** None (ADR-0007 is decided and committed at docs/adr/0007-generation-time-cli-mechanizes-boilerplate-steps.md). Independent of 03 and 04's output — can be built in parallel with both.

**Status:** ready-for-agent

- [x] `bake` writes to a new `<subject>-reference.html` file, anchored to the original subject (not
      chained onto the `-tuned` filename) — never overwrites the tuned file
- [x] `--values` is optional and sparse — it's an override map, not a required entry per control
- [x] `css-var` entries in `--values` are substituted into `:root` as plain static values
- [x] `class-toggle` entries in `--values` are hardcoded onto the target element in markup; the
      class-gated CSS rule is left as-is, not flattened into the base ruleset
- [x] Any css-var control *not* named in `--values` bakes in using that CSS custom property's
      current value already declared in the file's `:root` (its authored default, unchanged)
- [x] Any class-toggle control *not* named in `--values` bakes in using whichever option is marked
      `selected` (or radio marked `checked`) in the control's own markup
- [x] `bake <tuned-file>` with no `--values` flag at all is valid — every control bakes at its
      currently authored default, panel and overlay still stripped
- [x] Output file has the tuner-panel block (markup, style, script) entirely absent
- [x] Output file has the id-overlay block (markup, style, script) entirely absent
- [x] Tests added verifying output against the existing smoke-test invariant (tuner-panel/
      id-overlay markup, style, and script all absent from reference sketches), including the
      sparse/no-`--values` fallback paths
- [x] SKILL.md Step 6 updated to describe invoking the tool, and to require the agent ask the human
      *before* calling `bake` whether any tuner was moved from its default — e.g. "baking at current
      defaults, or did you land on something different for any of these?" — rather than silently
      assuming nothing changed and passing an empty/sparse `--values`. This is what makes the
      sparse-fallback mechanism safe: it's a deliberate "nothing changed" confirmed by the human, not
      an unchecked assumption. Reading a tuner's *current* value stays a human-tells-agent step (not
      scriptable — it only exists in live browser DOM state, not in the static file). Manual fallback
      procedure preserved alongside it for when Node isn't available

## Comments

Implemented in `tools/sketch-tool.js`: `bake <tuned-file> [--values '<json>']`. Parses the tuner
panel's controls (css-var and class-toggle, including hand-authored radio-group class-toggles per
`references/tuner-conventions.md`), validates every `--values` key against a real control target
(fails loudly on typos instead of silently no-op'ing), substitutes css-var overrides into `:root`,
hardcodes class-toggle overrides onto their target element via a small selector matcher (tag/#id/
.class), then strips the tuner-panel and id-overlay blocks by their existing marker comments. 15 new
tests added to `tests/test_static.py` (51/51 passing). SKILL.md Step 6 rewritten to invoke the tool
and require asking the human before baking; manual fallback procedure preserved underneath.
