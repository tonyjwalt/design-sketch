# Skill-shipped templates are copy-source, inlined at generation time — never a runtime dependency

Wireframe tokens, tuner-binding JS, and the ID-overlay snippet all needed to live somewhere so the
model isn't re-authoring boilerplate on every sketch. The alternative was letting a generated sketch
emit a small folder and `<link>`/`<script src>` back to shared files, which would have made
"self-contained single `.html` file" scoped to simple sketches only.

Decided instead that skill templates are read by the model and inlined into the sketch's own
`<style>`/`<script>` block at generation time. Every sketch — wireframe, tuned, or reference-stage —
stays exactly one self-contained file, no exceptions. The skill's internal template library is an
authoring convenience, not part of the output contract.

## Considered options

- **Shared assets folder for advanced modes** — rejected. Would have split "sketch" into two
  artifact shapes (plain file vs. file+assets folder) depending on which mode was used, and made
  "self-contained" mean different things in different parts of the same skill.
