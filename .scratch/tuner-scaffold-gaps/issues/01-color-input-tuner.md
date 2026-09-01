# 01: Mechanize color-input tuner scaffolding in `tune`

**What to build:** Running `tools/sketch-tool.js tune <file> --type css-var --target <property> --label <text> [--value <hex>]` with neither `--min`/`--max` nor `--options` should scaffold a color-picker control — `<input type="color" data-bind="css-var" data-target="<property>" value="<hex>">` — through the same generic `data-bind`/`data-target` binding mechanism the range and swatch shapes already use. It should follow the existing fork-or-append behavior (forks to `<subject>-tuned.html` against a panel-less file, appends to an existing panel otherwise) and work with the tool's existing `--edit`/`--remove`/`bake` machinery the same way range and swatch controls already do.

This closes the gap where color-input is the only tuner shape named in `CONTEXT.md`'s "Tuner" definition and `references/tuner-conventions.md` (and covered by smoke test S3) that isn't actually scaffoldable via the CLI — today it rejects the flag combination (`css-var` with no `--min/--max` and no `--options`) with "`--type css-var requires either --min/--max (continuous) or --options (swatch)`", forcing hand-authored panel markup. That manual fallback is what led to a real bug (see ticket 02).

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

- [x] `tune --type css-var --target <prop> --label <text>` (no `--min`/`--max`, no `--options`) produces `<input type="color" data-bind="css-var" data-target="<prop>" value="<hex>">`; `--value` sets the initial hex, defaulting to a sensible fallback (e.g. `#000000`) if omitted
- [x] Fork-or-append behavior matches the existing range/swatch controls: first `tune` call against a panel-less file forks to `<subject>-tuned.html`; subsequent calls append to the existing panel body
- [x] `--edit <target>` and `--remove <target>` work against a color control the same as they do today for range/swatch
- [x] `bake` reads a color control's current/authored value and freezes it into `:root` the same way it already does for range/swatch (via `bakeCssVarControls`/`substituteRootProp`)
- [x] `tests/smoke-tests.md` Test S3 still passes; update its pass criteria if the color input is now expected to come from the CLI path rather than hand-authored
