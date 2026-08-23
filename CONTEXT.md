# design-sketch

A skill that produces fast HTML/CSS sketches to visualize design ideas, moving through a lifecycle
from disposable exploration to a production-facing reference document, with optional modes
(wireframe tokens, tuners, ID reference) layered on top without breaking the core artifact contract.

## Language

**Exploration sketch**:
The default state of a sketch — cheap, disposable, one of several produced while approaching a
design. No tuners, no permanence expected. Preserved untouched once tuning starts — see ADR-0006.
_Avoid_: draft (too generic)

**Tuned sketch**:
A copy of an exploration sketch, forked (not edited in place — ADR-0006) with a tuner panel added to
hone in a specific value or layout variant. Becomes the live file further iteration continues on
until baked.

**Reference sketch**:
The sketch a design converges on — tuner values baked into static CSS, tuner panel and its binding
JS removed. Handed to production development as the source of truth for the finished design; never
carries a live control. Terminal: further feedback forks a new exploration sketch rather than
editing the reference in place — see ADR-0006.
_Avoid_: spec, final sketch (spec implies formal annotation this artifact doesn't have; "final"
doesn't capture that it's specifically meant for handoff)

**Bake**:
The act of freezing a tuned sketch's current control values into plain static CSS and deleting the
tuner panel and ID overlay (markup and JS for both), producing a reference sketch. One-way in
practice — baking is not meant to be undone, since a reference sketch existing implies the design
question is settled.

**Sketch**:
A self-contained HTML file (optionally with inline CSS/JS) that visualizes a design idea. Always
exactly one file — see ADR-0001.
_Avoid_: mockup, comp, wireframe (wireframe is a mode, not a synonym for sketch)

**Template** (skill-internal sense):
Source material the skill ships and reads from when generating a sketch — copy-source only, never
a runtime dependency of the output file. Distinct from a general "template file" a user might mean
elsewhere.
_Avoid_: asset, partial (implies something the output file references at runtime, which templates never are)

**Tuner**:
A native HTML control (range, select, checkbox, color input, swatch buttons) wired to a design value
via templated, generic binding JS. Two binding shapes:
- Continuous or fixed value → one CSS custom property, via a generic `input`/`click` listener
  (`style.setProperty`) — covers range, color input, and swatch buttons alike
- Discrete variant → a class or data-attribute toggle on a container, via a generic `change` listener

What gets tuned (which property, which class) is a per-sketch human decision, never inferred by the
model — only the wiring mechanism is templated. For color specifically, whether to use a swatch row
(a known palette to choose among) or an open `<input type="color">` (no palette yet, tuner is
helping find one) is a judgment call, not a fixed rule — both are legitimate.
_Avoid_: control (too generic once "tuner" is defined precisely)

**Wireframe mode**:
A fidelity mode for the HTML step that swaps in the skill's own shipped, portable semantic token
scale (named neutral roles, a primitive space scale plus usage-scoped aliases, radius scale, as
resolved CSS custom properties) instead of realistic content and colors. The scale's *shape* — role
names like `surface`/`line`/`text-muted`, a `3xs→4xl` space ladder with `inset`/`inline`/`stack`/
`layout` aliases over it, a `sm/md/lg/xl/full` radius ladder — is modeled on tonywalt.com's real
semantic token system as a structural reference, but the values and alias step-mappings are the
skill's own generic choices, not copied verbatim; the skill never inspects a target project's actual
tokens at generation time. See ADR-0003.

**ID overlay**:
A hover badge showing an element's id, with keyboard copy — `C` copies the id alone, `Alt+C` copies
the id plus the hovered leaf element's class — injected into exploration and tuned sketches by
default (opt-out, not opt-in). Removed at bake, same as the tuner panel — see ADR-0004. Copy is
keyboard-driven rather than click-driven because the badge tracks the cursor at a fixed offset, so
it can never be reached by moving toward it — clicking it would mean chasing (and, since the badge
itself has no id, an early click-handler design also hid it right as the cursor arrived).
