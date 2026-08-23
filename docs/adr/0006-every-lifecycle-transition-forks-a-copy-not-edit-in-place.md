# Every lifecycle transition forks a copy of the sketch, never edits it in place

The original design had exactly one fork point in the sketch lifecycle: bake (tuned → reference).
Adding a tuner panel edited the exploration sketch in place. This was an asymmetry — bake forks to
protect the tuned sketch before a destructive-ish transformation, but the same risk exists one stage
earlier: injecting a tuner panel's markup/style/script into a working exploration sketch can go
wrong, and in-place editing meant there was no way back to the clean version without regenerating it
— which stops being cheap once a sketch has accrued several rounds of manual iteration.

Decided that Step 5 forks a copy (`<subject>-tuned.html`) instead of editing in place. The
exploration sketch stays untouched and demoable; the tuned copy becomes the live file further
iteration continues on. This makes both lifecycle stage transitions that existed at the time
(exploration → tuned, tuned → reference) follow the same rule — fork, don't mutate — rather than
having bake be a special case.

The same question came up again for the transition off the *end* of the lifecycle: what happens
when feedback arrives on a reference sketch? Step 7 (Iterate) originally only said to update "the
current live file," which was well-defined for exploration and tuned sketches but silent once the
live file was a reference sketch — nothing said whether that meant editing the reference directly
(reinjecting a tuner panel and/or ID overlay) or starting over. Editing it in place would contradict
why the reference stage exists at all: ADR-0002 baked it specifically so a production engineer
reading it sees the finished value, not something still open to second-guessing. Applying this ADR's
rule rather than treating it as a new question: a reference sketch is terminal, and further
iteration forks a new exploration sketch, seeded from the reference's markup, restarting the
lifecycle at Step 1. The new file is named per Step 4's ordinary convention (a descriptive
`sketch-<subject>.html`), not mechanically chained onto `-reference` — what the new exploration is
about is a per-sketch judgment call, same as any first sketch, and the feedback that prompted the
fork may have shifted scope enough that the old subject name no longer fits.

`tools/sketch-tool.js create` enforces the mutation half of the reference case: it refuses to run
against any `-reference.html` file, closing the gap where nothing previously stopped it from
silently resurrecting the ID overlay into a file bake had already stripped it from (`create` is the
only subcommand that writes in place — `tune` and `bake` already fork, so they don't need the same
guard).

## Considered options

- **Edit in place, fork only at bake** — the original design. Rejected: kept the file count down by
  exactly one file, but broke the "clean version stays available" guarantee at the one point
  (tune-add) where an edit is most likely to visibly disturb the sketch, and made the fork rule
  inconsistent across the transitions instead of uniform.
- **Allow editing a reference sketch directly** — rejected for the same reason as the general rule
  above, and specifically reopens the second-guessing ADR-0002 baked to prevent; would also make the
  reference stage's "terminal" guarantee (SKILL.md's self-contained-file promise: at most the
  sketch's own `<style>`/`<script>`) untrustworthy, since a reference file could silently regain a
  tuner panel.
- **Mechanize the reference→exploration fork as a new `sketch-tool.js` subcommand** (e.g. `restart
  <reference-file>`) — rejected. Unlike overlay/tuner/bake injection, there's no boundary-marker text
  surgery here worth mechanizing — it's a plain copy with a fresh, judgment-based name, already
  covered by Step 4.
