# ID overlay is on by default (opt-out) and stripped at bake

Unlike wireframe mode and tuners, which are deliberately opt-in because they change what the sketch
looks like, the ID overlay only adds a hover affordance for referencing elements in feedback — it
doesn't affect the design being evaluated. Requiring an explicit request for something this low-cost
and this useful for the core feedback loop (pointing at a specific element when giving notes) would
mean it's usually missing exactly when it'd help.

Decided the overlay is present by default on every exploration and tuned sketch, removable only by
explicit request. It follows the same bake rule as the tuner panel: reference sketches strip it,
since dev-only affordances don't belong in a handoff artifact meant to read as finished.

## Considered options

- **Opt-in, like wireframe mode and tuners** — rejected. Those modes change the sketch's visual
  fidelity, a real decision worth gating. The overlay changes nothing about the design itself, so
  gating it just means re-asking for it every session.
