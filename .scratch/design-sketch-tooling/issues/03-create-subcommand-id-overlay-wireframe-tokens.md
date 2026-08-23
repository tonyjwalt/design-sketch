# 03 — `create` subcommand: id-overlay + wireframe tokens

**Priority:** P1 — core value delivery, mechanizes the two steps (3 and 4.9) that currently have
zero per-sketch judgment and the least room for the agent's manual copy to legitimately vary.

**What to build:** `sketch-tool create <file> [--type wireframe|styled] [--no-overlay]`, run
against an agent-authored exploration sketch, reliably injects the id-overlay block by default and
the wireframe-tokens.css custom properties into `:root` when `--type wireframe` is given —
replacing the hand copy-paste currently described in SKILL.md Steps 3 and 4.9.

**Blocked by:** None (ADR-0007 is decided and committed at docs/adr/0007-generation-time-cli-mechanizes-boilerplate-steps.md).

**Status:** ready-for-agent

- [x] `create <file>` injects the id-overlay block (markup + style + script) by default
- [x] `create <file> --no-overlay` skips id-overlay injection entirely
- [x] `create <file> --type wireframe` additionally injects the wireframe token custom properties
      into the file's existing `:root` block (merging, not duplicating, if `:root` already exists)
- [x] `create <file> --type styled` does not inject wireframe tokens
- [x] `create <file>` with no `--type` given behaves identically to `--type styled` — id-overlay
      injected, no wireframe tokens — since styled is SKILL.md's documented default fidelity mode
- [x] Running `create` twice against the same file does not duplicate either block
- [x] Tests added covering all of the above (extending tests/test_static.py and/or
      tests/smoke-tests.md)
- [x] SKILL.md Steps 3 and 4.9 updated to describe invoking the tool, with the manual fallback
      procedure preserved alongside it for when Node isn't available

## Comments

Implemented as `tools/sketch-tool.js` (`create` subcommand). Idempotency for the id-overlay block
is marker-based (`<!-- design-sketch:id-overlay -->` / `<!-- /design-sketch:id-overlay -->`); the
manual fallback in SKILL.md now also wraps the block in these markers so a later tool run against a
hand-assembled sketch recognizes it instead of duplicating it. Wireframe-token idempotency is
property-name-based (merges only `--wf-*` declarations not already present in the target `:root`).
16/16 tests pass (`python3 tests/test_static.py`).
