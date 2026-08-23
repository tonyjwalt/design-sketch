# 06 — `tune` subcommand: `--remove` / `--edit` existing controls

**Priority:** P2 — `tune`'s add path (issue 04) only grows a panel. Once a tuned sketch has a few
controls, there's no way to drop one or change its definition (min/max, label, target, options)
without hand-editing the tuned file directly.

**What to build:** two additional modes on the existing `tune` subcommand:

- `sketch-tool tune <file> --remove <target>` — deletes the control bound to `<target>` from the
  existing panel. If it was the only control, the entire panel block (markers, style, fieldset,
  script) is dropped, since an empty panel isn't a valid state per `references/tuner-conventions.md`.
- `sketch-tool tune <file> --edit <old-target> --type ... --target ... --label ... [...]` — replaces
  the control currently bound to `<old-target>` with a freshly built one from the given flags, in
  the same position in the panel. Takes the same flags as creating a control (issue 04) — it's a
  wholesale replacement, not a partial patch, so there's no ambiguity about merging old and new
  attributes. `--target` in the flags is the new target (pass the same value as `--edit` if it's
  not changing).

Both modes only operate on a file that already carries a tuner panel — same marker-comment check
`tune`'s existing add/append logic already uses. Neither mode forks a new file: per `docs/adr/0006`
and how Step 7 (Iterate) already treats the tuned file as the live file further iteration continues
on, these are in-place edits to that live file, same as append already is.

**Blocked by:** None. Builds directly on `tools/sketch-tool.js`'s `tune` subcommand from issue 04.

**Status:** ready-for-agent

- [x] `tune <file> --remove <target>` removes the control bound to `<target>`; errors clearly if no
      control has that target
- [x] `tune <file> --remove <target>` on a panel's last remaining control drops the entire
      marker-wrapped panel block (style, fieldset, script), not just an empty `<fieldset>`
- [x] `tune <file> --edit <old-target> --type ... --target ... --label ...` replaces the matching
      control in place, preserving the position of the other controls
- [x] `--edit`'s target can differ from `--remove`'s old target (i.e. editing can rename what a
      control is bound to)
- [x] Both modes error clearly against a file with no tuner panel yet, and against an unknown target
- [x] `--remove` and `--edit` are mutually exclusive with each other and with plain add-mode flags
- [x] Tests cover: remove one-of-many, remove-the-last-one, edit changing a value, edit changing the
      target, and the error paths above
- [x] SKILL.md Step 5 updated to mention `--remove`/`--edit` alongside the add/append behavior

## Comments

Implemented as `--remove`/`--edit` modes on the existing `tune` subcommand in
`tools/sketch-tool.js`. Both share `locatePanelFieldset` (also refactored `appendControlToPanel`
onto it, removing a near-duplicate marker/fieldset lookup) and `spliceFieldset`, which rebuilds the
`<fieldset>` from a fresh control-block list — an empty list drops the whole marker-wrapped panel.
`--edit` builds its replacement control against the panel with the old one already stripped, so
reusing the same `--label` doesn't trip the new control's own id-collision check against itself.
`CONTROL_DEFINITION_FLAGS` (used by `--remove`'s "no other flags" check) is derived from
`TUNE_VALUE_FLAGS` rather than hand-duplicated, so a future flag addition can't drift the two out of
sync. Ran `/code-review`; addressed all findings (extracted the shared panel-lookup helper, derived
the flag list, fixed a stray citation, added the missing `--edit`-on-no-panel test and a 3-control
position-preservation test that a 2-control fixture couldn't actually distinguish from
remove-and-re-append). 36/36 tests pass (`python3 tests/test_static.py`).
