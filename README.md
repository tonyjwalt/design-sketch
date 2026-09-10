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

## Install

The `design-sketch/` folder is the entire skill — everything else in this repo (docs, tests,
`CONTEXT.md`, `.scratch/`) is development-only and not needed at runtime. To install, copy just
that folder, e.g.:

```
cp -r design-sketch ~/.claude/skills/design-sketch
```

## Files

| File | Purpose |
|------|---------|
| `design-sketch/SKILL.md` | Workflow, HTML conventions, and the sketch lifecycle |
| `design-sketch/references/tuner-conventions.md` | Element-per-value-type mapping for tuner panels |
| `design-sketch/templates/wireframe-tokens.css` | Shipped grayscale/semantic token scale for wireframe mode |
| `design-sketch/templates/tuner-panel.html` | Control-panel skeleton with generic binding JS |
| `design-sketch/templates/id-overlay.html` | Hover-to-reveal-ID badge, press C to copy |
| `design-sketch/tools/sketch-tool.js` | CLI helper mechanizing create/tune/bake steps |
| `LICENSE` | MIT — free to use and redistribute |
| `CONTEXT.md` | Domain glossary — sketch lifecycle, tuner, bake, wireframe mode (dev-only) |
| `docs/adr/` | Architectural decisions, including why every sketch stays one file (dev-only) |
| `tests/` | Static structure checks and smoke tests (dev-only) |
