# Reference sketches bake tuner values into static CSS and remove the panel

A sketch can carry a tuner panel while it's being honed (a *tuned sketch*), but once a design
converges and the sketch becomes the handoff artifact for production development (a *reference
sketch*), the panel's live controls no longer belong: a production engineer reading it wants the
finished value, not an editable one that invites second-guessing something already decided.

Decided that reaching reference stage means baking — freezing the current tuner values as plain
CSS declarations and deleting the panel markup and its binding JS — rather than shipping the panel
forward into the handoff artifact.

## Considered options

- **Keep the panel in reference sketches** — rejected. A live slider in what's supposed to be the
  source of truth for production invites re-litigating values that were already settled during the
  tuning stage.
