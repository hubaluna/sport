# FORGE / 8 — 4.6

- Calendar follows the device's local date independently of training level, including startup, foreground, pageshow and midnight.
- Training level advances through completed A/B/C sessions rather than elapsed weeks. Missing sessions never skips program levels.
- After a gap of 7+ days, the next two primary workouts reduce sets and complex rounds. Max tests and strenuous optional pulls are deferred. Return sessions are journaled and do not trigger pull progression or graduate the training level.
- Existing diary dates/results, profile and storage keys are preserved. In-progress workout snapshots are unchanged.
- Warmup and cooldown use the adjusted movement plan.

Validation: node tests/calendar.cjs — 276 assertions. Covers the reported October 28 to November 9 gap, all eight levels and seven days, diary/active snapshot preservation, DST/year changes, return completion, profile edits and foreground refresh. Browser/visual retesting was unavailable during preparation of this release.
