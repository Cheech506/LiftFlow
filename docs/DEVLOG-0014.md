# DEVLOG-0014 — Active Set Controls

## Goal
Make active workout sets fully editable instead of limiting the logger to weight, reps, completion, and warm-up toggling.

## Completed
- Added Working, Warm-up, Drop, Failure, and AMRAP set types.
- Added actual RPE and RIR recording for each set.
- Added set movement, deletion, and type controls.
- Preserved copy-previous, add-set, complete, and uncomplete behavior.
- Kept weight and reps editable with the numeric keyboard accessory.

## Data safety
Existing sets without a newer set type still load as normal working sets.
