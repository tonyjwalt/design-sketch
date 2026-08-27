# 03: Scaffold boolean checkbox and radio-group class-toggle controls in `tune`

**What to build:** `tune --type class-toggle` currently only ever scaffolds a `<select>` (`buildClassToggleControl`), even though the tool's own read/bake logic (`extractControlValue`) already knows how to parse a checkbox's checked state and a radio group's checked option. Both shapes are documented in `references/tuner-conventions.md` ("Boolean... `<input type="checkbox">`" and "Discrete named options... `<select>` or radio group") but were never wired into the scaffold path. Add the two missing generation paths so `tune` can produce all three documented `class-toggle` shapes, not just `<select>`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] A new flag (e.g. `--boolean`, taking no value) on `--type class-toggle` scaffolds `<input type="checkbox" data-bind="class-toggle" data-target="<selector>" ...>` wired to add/remove one fixed class, instead of requiring `--options`
- [x] A new flag (e.g. `--radio`) on `--type class-toggle` with `--options` scaffolds a radio group (one `<input type="radio">` per option, sharing a `name`) instead of a `<select>`
- [x] Both new shapes work with the existing fork-or-append, `--edit`, `--remove`, and `bake` machinery the same way `<select>` does today (`extractControlValue` already supports reading both — see the checkbox and radio-group branches around lines 462-476 of `tools/sketch-tool.js`)
- [x] `validateTuneOpts` accepts the new flag(s) only in valid combinations (e.g. `--boolean` excludes `--options`; `--radio` requires `--options`) and rejects invalid ones with clear errors, mirroring the existing css-var validation style
