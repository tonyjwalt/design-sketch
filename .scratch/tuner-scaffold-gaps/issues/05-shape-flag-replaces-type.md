# 05: Replace `--type` with explicit `--shape`; infer css-var vs class-toggle from `--target` syntax

**What to build:** `tune`'s current `--type css-var|class-toggle` flag, paired with a control shape inferred from which value flags happen to be present, gets replaced by a single explicit `--shape <range|swatch|color|select|radio|boolean>` flag. The css-var-vs-class-toggle binding is no longer a separate flag the caller supplies — it's derived unambiguously from `--target`'s own syntax: a custom-property name always starts with `--` (required by the CSS spec), a CSS selector never does, so the two forms can never collide. `tune` validates that the declared `--shape` and the syntactic form of `--target` agree (e.g. `--shape range` requires a custom-property-syntax target; `--shape boolean` requires a selector) and errors immediately, before writing anything, if they don't.

This supersedes the *interface* delivered by tickets 01 and 03, not the underlying capability — `buildColorControl`, `buildCheckboxToggleControl`, `buildRadioToggleControl`, and `validateCssVarTargetInRoot` (ticket 02) all still apply; they get re-wired behind the new `--shape`-first argument parsing instead of the old `--type`-plus-flag-presence dispatch. It also absorbs ticket 04's documentation scope, since 04 documented an interface (`--type css-var`'s inferred shapes) that no longer exists — see the comment on ticket 04.

Agreed flag table per shape (`--target`/`--label` common to all):

| `--shape` | `--target` must be | Flags |
|---|---|---|
| `range` | custom property | `--min N --max N` (required), `--value`, `--unit`, `--readout` |
| `swatch` | custom property | `--options a,b,c` (required) |
| `color` | custom property | `--options a,b,c` (optional presets), `--value` (optional) |
| `select` | selector | `--options a,b,c` (required), `--value`, `--prefix` |
| `radio` | selector | `--options a,b,c` (required), `--value`, `--prefix` |
| `boolean` | selector | `--value` (required — names the class it toggles) |

**Blocked by:** None (can start immediately) — supersedes the interface of 01/03 (which remain done as originally scoped) and the scope of 04 (now `wontfix`)

**Status:** resolved

- [x] `--type` flag is removed from `tune`; `--shape` is required instead, one of the six values above
- [x] Binding mechanism (css-var vs class-toggle) is derived from `--target`'s syntax, not passed explicitly
- [x] `tune` errors immediately, before writing anything, if `--shape` and `--target`'s syntactic form disagree (e.g. a selector given where a custom-property name is required, or vice versa)
- [x] Each shape accepts exactly the flags in the table above; passing a flag that shape doesn't use errors rather than being silently ignored
- [x] `--edit`/`--remove`/`bake` all work against controls built under the new `--shape` scheme
- [x] `SKILL.md` Step 5 and `references/tuner-conventions.md` are updated to describe `--shape` (not `--type`) as the flag the model passes, and to describe binding as inferred from `--target`, not declared
- [x] `tests/smoke-tests.md` updated wherever it references the old `--type`/inferred-shape flag surface

## Comments

Implemented in `tools/sketch-tool.js`: `--type`/`--boolean`/`--radio` removed from `tune`'s arg parsing; `--shape` (`range|swatch|color|select|radio|boolean`) is now required and dispatches via a `SHAPE_DEFS` table that also drives per-shape flag validation and the binding-vs-target-syntax agreement check (`validateShapeTargetAgreement`), enforced before any file write. `color`'s table-listed optional `--options` is implemented as a `<datalist>` of preset values wired via the color input's `list` attribute (native browser preset swatches), not a second visible control — `buildColorControl` now takes `existingContent` for id-collision checking against the new datalist id, same as the continuous/radio builders already did. Verified end-to-end against a scratch sketch: fork+range+readout, shape/target mismatch errors (both directions), disallowed-flag-per-shape errors, append color-with-presets/boolean/radio, `--edit` swapping a boolean control to a select, `--remove`, and `bake` substituting a css-var override and baking a class-toggle default — all behaved as specified. `docs/adr/0007`'s `tune` example flag string was also updated to `--shape` per "flag ADR conflicts" (accuracy fix to an example, not a rewrite of the decision). Left for human sign-off: no automated JS test suite exists in this repo (only the manual `tests/smoke-tests.md`), so this checklist is verified by manual CLI exercise above rather than a runnable test.

Additionally verified by three independent general-purpose agents, each working cold (no shared context with the implementation session) against a different sketch and shape combination, entirely through `node tools/sketch-tool.js` with zero hand-authored panel/overlay markup: (1) a product-card sketch — range+readout, swatch, boolean, then bake with mixed css-var/class-toggle overrides; (2) a sidebar sketch — color with `--options` presets (confirmed produces a `<datalist>`, not swatch buttons, matching the docs), select, `--edit` to change its options, `--remove`, then bake; (3) a banner sketch — a deliberate `--shape`/`--target` mismatch first (confirmed the error message was self-explanatory enough to self-correct without reading source), then radio, range without `--readout`, then bake with a partial override. All three completed successfully. Two minor pre-existing rough edges surfaced, both out of this ticket's scope (predate the `--type`→`--shape` rename): a scaffolded `color` control always defaults its swatch to `#000000` when `--value` is omitted rather than reading the target's current `:root` value (ticket 01 behavior), and the tool doesn't honor a bare `--` as a Unix end-of-flags separator for target names that start with `--` (pass the value directly instead). Neither blocked any agent from completing its task. Resolving — no further action needed on this ticket.
