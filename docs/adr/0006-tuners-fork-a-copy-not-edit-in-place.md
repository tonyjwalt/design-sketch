# Adding tuners forks a copy of the exploration sketch, doesn't edit it in place

The original design had exactly one fork point in the sketch lifecycle: bake (tuned → reference).
Adding a tuner panel edited the exploration sketch in place. This was an asymmetry — bake forks to
protect the tuned sketch before a destructive-ish transformation, but the same risk exists one stage
earlier: injecting a tuner panel's markup/style/script into a working exploration sketch can go
wrong, and in-place editing meant there was no way back to the clean version without regenerating it
— which stops being cheap once a sketch has accrued several rounds of manual iteration.

Decided that Step 5 forks a copy (`<subject>-tuned.html`) instead of editing in place. The
exploration sketch stays untouched and demoable; the tuned copy becomes the live file further
iteration continues on. This makes every lifecycle stage transition (exploration → tuned, tuned →
reference) follow the same rule — fork, don't mutate — rather than having bake be a special case.

## Considered options

- **Edit in place, fork only at bake** — the original design. Rejected: kept the file count down by
  exactly one file, but broke the "clean version stays available" guarantee at the one point
  (tune-add) where an edit is most likely to visibly disturb the sketch, and made the fork rule
  inconsistent across the two transitions instead of uniform.
