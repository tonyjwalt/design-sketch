# design-sketch

Generate lightweight single-file HTML/CSS sketches to visualize proposals and design ideas.

## Activation

Trigger phrases: "sketch this", "visualize this proposal", "wireframe this", "draw me a..."

## How it works

1. Asks where to save sketches (first time per session)
2. Resolves ambiguity cheaply — ask → ASCII sketch → HTML sketch
3. Produces a self-contained HTML file, with an ID hover-overlay on by default
4. Optionally switches to wireframe fidelity (shipped grayscale token scale) when layout matters
   more than visual polish
5. Optionally adds a tuner panel (native HTML controls, templated binding JS) to hone a value live
6. Optionally bakes a tuned sketch into a reference sketch — tuner values frozen to static CSS,
   panel and overlay removed — for handoff to production
7. Iterates on feedback using the same effort ladder

Every sketch, at every stage, is exactly one self-contained `.html` file. See `docs/adr/` for why.

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Workflow, HTML conventions, and the sketch lifecycle |
| `references/tuner-conventions.md` | Element-per-value-type mapping for tuner panels |
| `templates/wireframe-tokens.css` | Shipped grayscale/semantic token scale for wireframe mode |
| `templates/tuner-panel.html` | Control-panel skeleton with generic binding JS |
| `templates/id-overlay.html` | Hover-to-reveal-ID badge with click-to-copy |
| `CONTEXT.md` | Domain glossary — sketch lifecycle, tuner, bake, wireframe mode |
| `docs/adr/` | Architectural decisions, including why every sketch stays one file |
| `tests/` | Static structure checks and smoke tests |
