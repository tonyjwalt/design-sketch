# design-sketch does not integrate `grill-me`

Considered pointing design-sketch at the `grill-me` skill for resolving ambiguity before drawing.
Rejected: `grill-me` is a full interview session, disruptive for a skill whose whole premise is
speed on routine requests, and it has `disable-model-invocation: true` — it can't be auto-triggered
regardless. Ambiguity resolution stays entirely in design-sketch's own lightweight ask → ASCII → HTML
ladder (unchanged from the original skill), which already asks questions by default without needing
a heavier session bolted on.

## Considered options

- **Reference `grill-me` as a manual escalation pointer** for contested ideas — also rejected, on
  reflection. The ladder's own "ask" step already covers "ask questions before drawing"; a separate
  pointer to a whole other skill added a decision (when is something "contested enough") without a
  clear enough trigger to be worth documenting.
