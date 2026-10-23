# Replay verification (self-proof projections, session 3)

All three declared lever self-projections verified on 2026-10-22 (session 3).

## 1. Manifest hash chain

`node levers/check-manifest.js`: 55 artifacts hash-exact, 4 append-supersets (the growing jsonl files: detections.jsonl, defects.combined.jsonl, runs.jsonl, writers/verified.jsonl), 0 failures, of 59 distinct recorded artifacts.

## 2. mine-defects byte-diff (fresh clone)

Fresh clone of showdownjs/showdown from GitHub (HEAD = frozen SHA d1a8d16, upstream unmoved). `node levers/mine-defects.js <fresh-clone> replay-` reproduced data/defects.raw.jsonl **byte-identical** (cmp exit 0): 276 candidates, 0 merges, 9 test-only commits. Self-proof PASS.

## 3. detect spot-replay (differential reproduction)

One contaminated defect per repo, one round, failing-test-name comparison against the recorded P2 rows:

- showdown 12b616f3 (table header id): replay failing_tests == recorded failing_tests, exact array match (2 tests). Tree verified clean before/after.
- sql-formatter de7587e5 (singlestoredb % operator): replay == recorded, exact array match (2 tests). Tree verified clean before/after.

Self-proof PASS for both repos.

## 4. run-matrix config fingerprints

Recorded in every runs.jsonl row at execution time (sha256 of cell config + stryker version). Timing fields excluded from the self-proof projection per protocol (declared field-exclusion list); wall-clock reproduction is not claimed under external load (documented environment constraint).
