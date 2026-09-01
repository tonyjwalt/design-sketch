# 02: `tune` validates a css-var target is declared in `:root` before scaffolding

**What to build:** Before generating a css-var control (any of range/swatch/color), `tune` should check that `--target` is actually declared inside the file's `:root { ... }` block, and fail fast with a clear error if it isn't — instead of silently writing a control that will never visibly affect the page.

This is the root cause of a real incident: a tuner's binding script sets the value via `document.documentElement.style.setProperty(...)`, which only takes effect if nothing else re-declares the same custom property closer to the target element. A property declared on a descendant selector (e.g. `#site-nav { --nav-bg: ...; }`) silently shadows whatever the tuner sets at the root, and the control just does nothing — no error anywhere in the chain. `bake`'s existing `substituteRootProp` already assumes root-scoping; this ticket makes that assumption an explicit, enforced precondition at scaffold time instead of an unstated one that fails silently downstream.

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

- [x] `tune --type css-var --target <prop> ...` reads the target file's `:root { ... }` block and errors immediately (before writing anything) if `<prop>` is not declared there
- [x] Error message names the property and says where it needs to live (in `:root`), not a generic parse failure
- [x] Applies uniformly to all three css-var shapes (range, swatch, and color once ticket 01 lands)
- [x] A target legitimately declared in `:root` — including via `var()` indirection, e.g. `--nav-bg: var(--color-surface);` — is accepted, not just a literal value
- [x] `--edit` re-validates the (possibly new) target the same way `create`/first-add does

## Comments

Verified against current `tools/sketch-tool.js`: `validateCssVarTargetInRoot` (line ~363) throws `custom property "<prop>" is not declared in :root — ...` and is called from all three css-var shapes in `buildControlMarkup`'s switch (range/swatch/color, lines ~376-383, post ticket-05 refactor). `isCustomPropDeclaredInRoot` (line ~108) matches on property name only, independent of whether the declared value is a literal or a `var()` reference, so indirection is accepted. This ticket's checkboxes and status were stale — the work landed as part of implementing 01/05 but this file was never updated to reflect it; no code changes made here, bookkeeping only.
