# 04: Update SKILL.md Step 5 to document the color-input tuner shape and `:root` validation

**What to build:** `tools/sketch-tool.js tune` now supports a third `--type css-var` shape — an open `<input type="color">`, scaffolded when neither `--min/--max` nor `--options` is given — and validates that `--target` is declared in the sketch's `:root` before scaffolding any css-var control, erroring otherwise (see the `custom property ... is not declared in :root` check). `SKILL.md`'s Step 5 walkthrough — the doc actually consulted mid-workflow to invoke the tool — still describes `--type css-var` as only ever taking `--min/--max` or `--options`, "never both," with no mention of the color-input path or the `:root` precondition. Update the prose (the tuner-conventions reminder bullet, and the paragraph right after the `tune` command block) so it accurately reflects what the tool does today, the same way it already documents `--boolean`/`--radio` for `class-toggle`.

**Blocked by:** 01 (color-input scaffolding), 02 (`:root` validation) — both appear implemented in `tools/sketch-tool.js` already, but 02's checkboxes are unticked; spot-check both tickets' acceptance criteria against the current code before writing the doc update.

**Status:** wontfix

- [ ] Step 5's intro bullet (currently says a css-var control is "continuous or a swatch") also names the color-input shape
- [ ] The paragraph following the `tune` command block describes all three `--type css-var` shapes (range, swatch, color-input-by-omission) with the same clarity it already gives `class-toggle`'s three shapes
- [ ] The same paragraph states the `:root`-declaration precondition and that `tune` fails fast if it's missing
- [ ] No change to the tool itself — this ticket is documentation-only

## Comments

Superseded by ticket 05. `--type` (and shape-by-flag-presence inference under it) is being removed entirely in favor of an explicit `--shape` flag with the css-var/class-toggle binding inferred from `--target`'s syntax — so there is no longer a `--type css-var` interface to document. Ticket 05 folds the doc update (`SKILL.md`, `references/tuner-conventions.md`) into its own acceptance criteria instead.
