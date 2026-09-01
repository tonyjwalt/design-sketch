# A generation-time Node CLI mechanizes boilerplate injection and bake, with manual fallback

Several steps in the workflow are pure text manipulation on a known HTML file — inlining
`wireframe-tokens.css` into `:root`, inlining `id-overlay.html`, forking a sketch and injecting or
appending a tuner control, and bake's substitute-values-then-strip-both-blocks. The model has been
doing these by hand: reading the relevant template and reference doc, then copy-pasting and editing
markup into the target file. That works, but it re-derives the same mechanical result every time at
real token cost, and bake in particular has no error signal when it goes wrong — get a tuner's
`data-bind`/`data-target` backwards, or leave a stray fragment of the panel behind, and nothing
complains (`tests/smoke-tests.md` Test S4 exists precisely because this can fail silently).

Decided to add a single Node CLI, invoked by the model during generation, that performs these
specific mechanical operations:

- `create <file> [--type wireframe|styled] [--no-overlay]` — Steps 3 + 4.9
- `tune <file> --shape range|swatch|color|select|radio|boolean --target ... [...]` — Step 5,
  fork-or-append depending on whether `<file>` is already a tuned sketch with a panel
- `bake <tuned-file> [--values '<json>']` — Step 6, fork to `-reference.html`, substitute given
  values (falling back to each control's own authored default for any control left unspecified),
  and strip both blocks entirely

This is scoped as **one script with subcommands**, not several standalone scripts — the operations
share the same underlying primitive (find a block by its boundary markers, insert/delete/substitute,
write out), and a single entry point means the model only needs to recall one tool name plus
`--help` instead of picking the right one of several similarly-named scripts.

The tool is a **generation-time aid only, never a runtime dependency of the sketch it produces** —
consistent with ADR-0001. A sketch that used it is byte-for-byte the same kind of artifact as one
hand-assembled without it; nothing about the output file changes, and nothing about the file depends
on the tool continuing to exist. If Node isn't found on the user's machine, the model falls back to
the pre-existing manual copy-paste procedure described in `SKILL.md` — this is a reliability and
cost optimization on top of that procedure, not a replacement that could turn into a hard failure.

`bake` keeps its own name rather than becoming `create --type reference`. "Reference" is already the
lifecycle-stage noun and "bake" is already the verb that produces it, per `CONTEXT.md` — matching
the CLI's vocabulary to the skill's own avoids introducing a second way to say the same thing.

What stays entirely with the model, not the tool: which fidelity mode, what content the sketch
itself contains, what gets tuned and what the option values are, and — critically — what value each
tuner control is *currently* at. That last one only exists in live browser DOM state; the static
file's `value`/`selected` attributes reflect authored defaults, not what got dragged in the browser.
So before calling `bake`, the model still has to ask the human which controls (if any) they moved
from default — the tool makes that answer easy to apply, but can't produce the answer itself.

## Considered options

- **Several standalone scripts, one per operation** — rejected. Every operation reduces to the same
  primitive, so splitting them just means duplicating or importing shared logic across files, and
  gives the model more tool names to misremember for no benefit over subcommands on one entry point.
- **Ship it as a hard dependency sketches rely on at runtime** (e.g. a shared `<script src>` the
  generated HTML points at) — rejected outright by ADR-0001; would have split "sketch" into two
  artifact shapes depending on whether the tool was used to make it.
- **Require Node with no fallback** — rejected. Distributability matters more than the marginal
  reliability gain of refusing to work at all on a machine without Node; the manual procedure this
  replaces already exists and already works, so falling back to it costs nothing new.
