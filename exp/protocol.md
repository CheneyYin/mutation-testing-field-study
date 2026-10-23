# Experiment protocol v2 (preregistered)

Frozen before funnel execution. 2026-10-22. Machine env: 8 cores, 15G RAM (~2G free), 2.0G disk free on single /, node v24.19.0, npm 11.17.0, git 2.43.0.

## Research questions

- RQ1: wall-clock cost of StrykerJS mutation testing; measured worth of concurrency, incremental (change ladder), ignoreStatic, hitLimit. Dry-run coverage selection is intrinsic, not ablatable; RQ1 claims only what is measured.
- RQ2: do tests written by subagent writers guided by survived mutants (state=Survived only) detect more independent real defects (reverse-applied git bugfixes) than coverage-guided writers (whole-repo uncovered lines), at equal capped effort.

## Preregistered hypotheses (corrected forms)

- H1: total = dryRun + staticCount*suiteTime/P + nonStaticSum/P'. P measured in a calibration pair (conc 1 vs max on a fixed mutant subset). Fitted on a random half of cells, validated on the other half.
- H2: incremental rerun time grows with injected change size (ladder 1/10/100 modified source lines, synthetic patches, reverted and hash-verified after each run). No repo-size claim (single repo).
- H3: ignoreStatic savings ~= staticCount * suiteTime / concurrency. staticCount measured at smoke run.
- H4 (guess, tested): A > B on defect detection, primary criterion A vs B.

## Funnel (preregistered gates and score)

- Stage 1 (API): primary language JS/TS; license in {MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD}; not archived; pushed within 365 days; stars <= 20000 (fame gate, mitigates training-data contamination in writers).
- Stage 2 (clone, blob:none, one at a time, deleted after): test runner jest or vitest (devDeps or test script); src LOC in [5000, 50000] (src/ or lib/, JS/TS excluding tests, .d.ts, dist); bugfix commits (message matching any of fix/bug/correct/handle/patch, case-insensitive) >= 30 total.
- Stage 3 (top candidates, one installed at a time): npm ci; suite green twice consecutively; each run < 120s wall; stryker smoke worst-corner completes.
- Score (lexicographic, descending): (1) bugfix commits in last 730 days; (2) suite wall time (lower wins); (3) |srcLOC - 15000| (mid-range proximity); tie-break fewer stars.
- Fallbacks: if < 4 candidates survive stage 2, relax stars gate to <= 50000 as declared amendment; if still < 4, extend candidate list before proceeding. Seeded-defect fallback is DELETED (unblinded seeding invalidates RQ2). Second-repo fallback allowed only with a budget line; analysis stratified by repo.

## Defect pool construction

- Mine mixed commits; reverse-apply only src-side hunks (path filter). Message pattern: any of fix/bug/correct/handle/patch (case-insensitive). Manual judgment kept only for genuine-behavior-fix; path globbing mechanical.
- Declared exclusion categories: pure locale/data-string fixes; docs/CI-only; feature commits. Each exclusion counted and reported.
- Conflict-excluded fixes counted. Later test-only commits (e.g. "test: cover #N") mined; defects they cover are marked contaminated.
- P2 is a screening gate: baseline-detected defects form the contaminated stratum (reported separately); primary criterion runs on the headroom (baseline-undetected) stratum.
- Per-defect semantic gate: reverse-applied tree must install/build; if > 80% of previously-passing tests fail, defect is semantically invalid, excluded with count. Per-run timeout declared (300s); timeout recorded as distinct state, counts as detection only if a named test fails before timeout.

## Detection definition (differential)

Defect D is detected by suite S iff >= 1 test fails on (S, D) AND passes on (S, clean). Each arm's suite must be green on clean HEAD (2 consecutive runs, per-test results recorded) before P4. Suite must remain green at P4-time re-verification.

## Arms and writers

- A: 3 independent subagent writers, stimulus = survived mutants (state=Survived only), mechanically selected: sorted by file:line, top N, N fixed identically for both arms.
- B: 3 independent subagent writers, stimulus = whole-repo uncovered lines, same N.
- C: frozen suite (P2 doubles as C; change log is proof; no P4 rerun).
- Effort: caps are max new test blocks and assigned items; budget unit = turns/tokens targets enforced by harness; deviations recorded as protocol violations. Writers have identical tool access (may run suite). Mandatory finalization phase before any hard kill. Tests are append-only: post-arm diff must show existing test files byte-identical (mechanical check).
- Writer sandbox: git archive export, no .git, no network, only src + frozen suite + stimulus file. Full tool-call logs; post-hoc grep for git/network access; hits trigger preregistered handling rule: writer's output quarantined and writer rerun.
- Writers may not modify source files; enforcement by post-arm mechanical diff of src.

## Statistics

- Estimand: superpopulation of exchangeable defects; frozen list is the sample. Paired analysis: exact McNemar on discordant pairs, primary comparison A vs B at writer-aggregate level (per-writer detection also reported). Newcombe/paired bootstrap for effect size intervals.
- Threshold set at P0-freeze time from power arithmetic on frozen n: significance needs ~6+ net discordant defects (6:0 -> p=0.031). If n_headroom underpowered, report interval, no forced conclusion.
- Multiplicity family: {A vs B} only; A vs C and B vs C reported as secondary mechanistic checks, no correction entry.

## Levers and self-proof projections

- mine-defects: rerun on fresh clone, byte-diff defects.jsonl.
- apply-defect: reverse-apply then checkout, byte-diff working tree.
- detect: verified-clean assertion (git status empty) between runs.
- run-matrix: config-fingerprint equality (timing fields excluded from self-proof projection, declared field-exclusion list).
- Checkpoints: append-only manifest exp/data/manifest.jsonl with {phase, artifact, sha256, rows, schema_ver, ts}. Analysis refuses to emit tables unless all manifests verify. Timestamps are not evidence; hashes are.

## Data shapes

- runs.jsonl: repo, config_fingerprint (hash of resolved config + stryker version + env + port-hygiene flag), dryRunSeconds, total_mutants, counts_by_state {killed, survived, noCoverage, timedOut, errored, ignored, staticStaticIgnored}, staticCount, reusedCount, wallclock_s, cpu_s, mutants_per_min, concurrency, cores, cpu_model, node_ver, stryker_ver, runner_ver.
- defects.jsonl: fix_sha, parent_sha, src_paths, msg, manual_confirmed, excluded_reason (nullable), contaminated_by_test_commit (nullable).
- detections.jsonl: key = defect x suite_version x round; fields: exit_code, failing_tests (list), timeout_flag, clean_pass (for suite_version), ts.
- stimulus.jsonl (frozen): {arm, item_id, file, line, kind, mutant_state}.
- writers.jsonl: {arm, writer_id, model, prompt_sha256, tool_log_path, turns, tokens, artifact_branch, protocol_violations}.

## Matrix (amended for environment)

- Factorial: concurrency {1, 2, 4} x mutate scope {small, medium, full}, 2 repeats. Full-core 8 dropped if memory-constrained; per-run environment fields record actuals; any deviation is a declared amendment in the run row.
- Single-point pairs: ignoreStatic true/false at reference config (small scope, conc 2); hitLimit default vs very high at reference config. Incremental ladder: 1/10/100-line synthetic patches, reverted and hash-verified between runs.
- Worst-corner smoke BEFORE matrix commits; static-heavy cell cost extrapolated via H3 corrected form; per-cell wall-clock cap with kill-switch recording truncation.
- Port hygiene preflight (grep listen/createServer/port literals); cross-concurrency killed-set invariance check; configs violating invariance flagged and excluded from fits.

## Budget envelope

Machine 8-15h target, hard cap 20h. Human (incl. manual defect confirmation) 15-20h estimate. Disk: single clones only, scratch deleted after measurement; winner-only persistent install.

## Amendment log

- 2026-10-22 v2: all interrogate-driven amendments (differential detection, headroom partition, writer replication 3x30min, git-less sandboxed writers, H3 corrected, H2 change ladder, matrix reduction, manifest hash chain, fame gate, seeded-defect fallback deleted).
- Open choice approved: 3 writers x 30min over 2 x 45min (replication over depth).
