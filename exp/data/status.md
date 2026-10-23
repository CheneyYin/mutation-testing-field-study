# Experiment status & decision log

Session 2, 2026-10-22 (evening). Continues session 1 (P0-P2). All artifacts hash-chained in data/manifest.jsonl (77 entries).

## Completed this session

- P1 matrix (13 recorded cells on showdown, StrykerJS 10.0.0): small scope (heading.js, 401 mutants) at conc {1,2,4}; medium (3 helper files, 256 mutants, 71% static) at conc {2,4}; h3_false pair; hitLimit pair. Two cells lost to environment: s_c4_r1 (ReDoS dry-run flake, retried OK as s_c4_r1b), s_c1_r2 (2700s cap truncation under load).
- Guidance runs for P3 stimulus: showdown 4 defect-file frame (810 mutants, 23min, taskset-pinned after 20+ dry-run flakes), sql-formatter 8-file frame (987 mutants, 96% static, 8m50s).
- P3 writers: 6 subagent sessions (3x arm A survived-mutant-guided, 3x arm B uncovered-line-guided), same 30-item stimulus frame, 12-block cap. All passed mechanical gates: insert-only diffs, no src changes, full-suite green 2x both repos. One b2 test file dropped (module-cache semantics, recorded as writer error).
- P4 differential detection: 7 suite versions x 5 headroom defects x 2 rounds (84 rows) + earlier full P2 screen.

## Key results

### RQ1 (time)

- Per-mutant wall (small scope): conc1 4.4s, conc2 2.9-3.1s, conc4 1.1-1.8s. Load variance (shared machine, 8 cores, external bursts to load 17) dominates: conc4 spans 499-767s for identical work. H1 parametric fit underdetermined at conc1 (n=1 usable); descriptive rates reported instead.
- Killed-set invariance ACROSS concurrency: 27/258 flips (~10%) between conc1 and conc2. Mutation testing's own verdicts are not concurrency-invariant under load.
- H3 corrected model refined: ignoreStatic only defuses PURE static mutants (6 of 48 on heading.js). Hybrid statics (42) run covering-tests-only and are cheap when coverage is thin. Measured h3 pair: savings -183s (noise-dominated, within +-400s machine variance); the Stryker "91% of time" warning overestimates for this repo shape. Static pain is real in static-DENSE files (medium scope: 6.9s/mutant, helpers covered by nearly all 3174 tests).
- hitLimit 1e6 vs default: states identical (252 killed/113 survived), wall 897s vs 1183s (noise range). No measurable effect at this scale.
- sqf (jest, 8 TS files, 987 mutants): 8m50s total, 80% mutants auto-ignored as pure static. Keyword-table TS files are mutation-cheap.

### RQ2 (quality) - preregistered verdict

- n_headroom=5 (after reclassification: b5d4799c = equivalent defect, Math.imul polyfill dead-code removal; ec6e2505 = contaminated once grammar regenerated).
- Arm A (mutation-guided, writer-aggregate): 0/5 detected. Arm B (coverage-guided): 1/5 (b13d7b22, the --!> comment terminator, caught by b1 AND b2). Arm C (baseline): 0/5.
- A-vs-B discordant pairs: B-only=1, A-only=0. Exact McNemar p=1.0. As preregistered: underpowered null result, reported as interval, no forced conclusion.
- MECHANISTIC FINDING (the real story): headroom defects live in UNCOVERED code (that is why no test catches them). Survived-only guidance (arm A stimulus = state=Survived) structurally cannot point there - those mutants are NoCoverage. Uncovered-line guidance (arm B) points exactly there. The single detectable-and-detected defect was B's home turf. Reviewer B's finding 11 predicted this location-lottery effect precisely.
- Writer kill claims (arm A, self-reported + spot-verified): 27/30, 28/30, 26/30 targeted mutants killed; 2-4 per writer identified as equivalent mutants (wasted-effort share ~10%, as preregistered to record). Post-arm mutation scores PENDING (see below).

## Validity incidents & amendments (all recorded, all in manifest)

1. Sandbox export-ignore bug: showdown .gitattributes export-ignores /test and scripts/; git-archive sandboxes shipped without them; 6 writers reconstructed infrastructure differently. Fixed by ls-files tar export; writers' test imports re-bound from stale-dist self-reference to virtual:showdown (src), equally for both arms, test logic untouched.
2. b5d4799c and ec6e2505 reclassifications (phantom/equivalent defects found by differential re-testing).
3. Frame reduced under budget + load: showdown stimulus = 4 defect files (guide run), sqf = 8 files. Both arms share the identical frame (contrast fair).
4. sql-formatter grammar.ts is gitignored+generated: detection of .ne-touching defects requires nearleyc regen (pipeline rule added); sandboxes must copy grammar.ts (build-sandboxes fixed).
5. ReDoS timing tests (showdown) are concurrency/load-unsafe: 4+ dry-run failures; taskset -c 4-7 CPU pinning + retry loops are the working mitigation.
6. Machine contention: external load (other opencode sessions, load avg up to 17) dominates timing variance; all cells carry env fields; l-cell wall labeled guidance-quality.
7. Writer prompt said sqf tests live in src/__tests__/ (they live in test/): all 6 writers discovered and adapted; both arms equally affected.

## PENDING (turnkey, next session)

- Post-arm mutation scores: `bash exp/levers/score-suites.sh` (rc bug fixed, retry-hardened, taskset-pinned; ~2.5h machine; gives A-vs-B kill-rate contrast on the 4-file frame, base=456/810 killed).
- Incremental ladder (H2): `bash exp/levers/ladder.sh` (~1h; comment-only 1/10/100-line patches, hash-verified revert).
- Full replay verification: manifest chain intact; rerun levers end-to-end on a fresh clone to reproduce defects.jsonl + detections (byte-diff per self-proof projections).

## Audit trail

- Writers: insert-only diffs verified against tracked-file reference; frozen repos clean throughout; log-level audit of writer window: 0 network, 0 git, 0 answer-key reads. Limitation: subagent tool-call transcripts not persisted by this harness; permission-log grep used instead.
- Detection pipeline: verified-clean tree assertion between every apply/detect cycle; differential definition (fails with defect AND passes on clean) enforced via per-suite clean-HEAD gates.


## Session 3 (2026-10-23): completion

- Replay verification: manifest chain 55 exact + 4 append-supersets 0 FAIL; mine-defects byte-identical on fresh clone; detect spot-replays exact-match both repos (data/replay-verification.md).
- Post-arm scores (4-file frame, conc2 amendment, in-frozen-repo overlay pattern after symlinked-node_modules sandbox bug): A arm 69.0/69.1/69.0% vs base 66.3% (+2.7pp, each killing 17-18 survived mutants); B arm b1/b2 exactly base-level (0 new kills); b3 64.8% via a reproducible mechanism: its dynamic-import consolePolyfill test executes module-load code at test runtime, de-static-ifying all 35 Ignored mutants into the denominator (26 survive). Score-comparability gotcha documented.
- H2 ladder (CPU, comment-only patches, hash-verified reverts): k=1: 1921s->74s (96% saved, 6/401 rerun); k=10: 1921s->102s (95%, 18 rerun); k=100: 1941s->168s (91%, 48 rerun). Monotonic in change size; ~0.5 rerun mutants per changed line.
- Machine total for whole experiment: ~14h (within 20h cap).
- ALL PREREGISTERED LEVERS EXECUTED. Experiment closed.

## Session 4 (2026-10-23): report

- Delivered exp/report/mutation-testing-report.md (prose, 8 chapters, 3-tier evidence discipline, evidence master table D1-D10/G1-G4/E1-E14) + mutation-testing-report.html (self-contained, 59 KiB, zero external refs, 3 inline SVG charts, 10 tables, 51 cite badges, dark/light, print-friendly) + build-report.js (the lever: reads md + jsonl sources, deterministic byte-identical rebuilds verified twice).
- Reader-view audit 20/20 pass: scores/cost/ladder/p4 tables regenerated from HTML cross-checked against jsonl sources; TOC anchors 8/8; zombie separator-row bug found and fixed (dynamic join lost trailing pipe).

## Session 7 (2026-10-23): public release

- Repo initialized at the workspace root; committed set = exp/ minus repos/, sandbox/, data/writer-refs/ (all regenerable: repos via bootstrap-fresh.sh at frozen SHAs, writer-refs via verify-writer.sh, sandbox via build-sandboxes.sh).
- Root scaffolding added: README.md (structure, reproduction, evidence discipline), LICENSE (MIT), .gitignore, exp/levers/bootstrap-fresh.sh (validated in-repo recipes: neutral-dir pnpm@11.9.0, --no-save stryker installs, nearleyc regen, jest-environment-node hoist).
- Secret scan before publish: no tokens; grep hits in reports are sql-formatter's own URL-formatting code fragments (password in userinfo), not credentials.



