# Freeze record (P0.4)

- repo: showdownjs/showdown
- frozen HEAD: d1a8d16344b855ea2f37677ee8a9e0cc2c597ea4 (Merge branch 'develop', 2026-08-19)
- source root: src/ (78 JS files); test root: test/
- install: npm ci (package-lock.json present)
- green gate: 2 consecutive runs of `npx vitest run`, exit 0, 13s / 13s, 25 files, 3174 tests, 0 failures
- logs: logs/freeze_green_run1.log, logs/freeze_green_run2.log

## Amendment (recorded at freeze)

- Detection path is `npx vitest run` (the suite proper). `npm test` = lint + vitest; lint is not a test and lint failures on defect trees are recorded but never counted as detection.
- Detection runs and clean-HEAD gates use vitest run with CI=true.
