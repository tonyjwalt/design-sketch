# Tuner Conventions

How to build a tuner panel using only native HTML form elements. What gets tuned is always a
per-sketch human decision — these conventions cover the mechanism, not the choice of target.

## Element per value type

| Value shape | Element | `data-bind` |
|---|---|---|
| Continuous (spacing, size, opacity) | `<input type="range">` + adjacent number readout | `css-var` |
| Discrete named options (variant, alignment) | `<select>` or radio group | `class-toggle` |
| Boolean (visible, enabled) | `<input type="checkbox">` | `class-toggle` with one fixed class |
| Known palette to choose among | Row of `<button value="...">` swatches | `css-var` |
| No palette yet — tuner is helping find one | `<input type="color">` | `css-var` |

Both color options are legitimate; which one fits depends on whether there's already a palette to
choose among, or the tuner's job is to help find one — not a fixed rule yet, use judgment. A swatch
button's `value` attribute holds the fixed color it applies; the panel's script reads it the same
way it reads a range or color input's `.value`.

## `data-target` means different things per `data-bind`

- `data-bind="css-var"` → `data-target` is a CSS custom property **name** (e.g. `--space-md`)
- `data-bind="class-toggle"` → `data-target` is a CSS **selector** for the element to toggle the
  class on. There's no fixed wrapper id to assume — target whatever real element the class actually
  belongs on in that sketch (often `body`, or an id/class the sketch already has)

Get this backwards and the panel silently does nothing — there's no error, the selector/property
just doesn't match anything. Check `templates/tuner-panel.html`'s own two examples before wiring a
new control.

## Readouts

A continuous control's "adjacent number readout" is `data-readout="someId"` on the `<input>` plus a
matching `<output id="someId">` — the template's generic listener writes to it automatically. Don't
hand-write a readout binding; if a control needs a readout and doesn't have `data-readout` wired,
that's a template gap, not something to patch with one-off JS.

## Panel rules

- Always one `<fieldset class="tuner-panel">`, positioned fixed in a corner, never inline in the
  layout being tuned
- One `<legend>` naming what's being tuned
- Each control's `<label>` names the value in plain language, not the CSS variable
- Never wire a control to more than one target
- Keep the panel markup, style, and script contiguous and not interleaved with sketch content — it
  all gets deleted in one pass at bake time (`SKILL.md` Step 6)
