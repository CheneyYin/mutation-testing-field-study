// gen-writer-prompts: render the 6 frozen writer prompts (differ only in guidance block).
// Records prompt sha256 into data/writers/manifest.jsonl for the frozen-artifact trail.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const D = path.join(__dirname, "..", "data");
const SB = path.join(__dirname, "..", "sandbox");
const W = path.join(D, "writers");
fs.mkdirSync(W, { recursive: true });

const COMMON = (w) => `You are a test writer improving the test suite of two open-source projects. Work inside your sandbox only: /home/yanchengyu/expr/stryker-mutator/exp/sandbox/${w}/showdown and /home/yanchengyu/expr/stryker-mutator/exp/sandbox/${w}/sql-formatter

## Hard rules

- showdown: create new test files or append new test blocks to EXISTING files under test/ only. Never modify or delete existing tests.
- sql-formatter: tests live in src/__tests__/ (files ending .test.ts, plus behavesLike*.ts shared helpers). Create new .test.ts files there or append new test blocks to existing ones. You may add helpers to behavesLike*.ts but never modify or delete existing tests or helpers. Do not touch any other src/ files.
- Never touch configs, build files, or anything outside the test directories described above. Do not modify or delete existing tests.
- No network access. No git commands (the sandbox has no history anyway). Do not read files outside your sandbox.
- Every test you write must call the real code with concrete inputs and assert a literal expected output (exact string/number/boolean). A test that would still pass if the code under test returned undefined is a bad test; do not write those.
- Prefer testing observable public behavior (the converter output, the formatter output), not internal helpers.

## How to verify

- showdown: cd /home/yanchengyu/expr/stryker-mutator/exp/sandbox/${w}/showdown && npx vitest run (full suite must stay green)
- sql-formatter: cd /home/yanchengyu/expr/stryker-mutator/exp/sandbox/${w}/sql-formatter && node_modules/.bin/jest (full suite must stay green)
- Run the suite after each batch of tests you add. If your test fails, fix it or delete it. The final state must have the full suite green with your tests included.

## Budget

- Address at most 30 targets from targets.jsonl (in the sandbox root, one line per target).
- Add at most 12 new test blocks (an "it(...)" or "test(...)" counts as one block).
- Stop when either cap is reached or you judge remaining targets not worth tests, then do a final full-suite verification pass.

## Report at the end

- Number of targets addressed, number of test blocks added, files created/modified.
`;

const GUIDANCE_A = `## Your task

targets.jsonl lists survived mutants: places where deliberately broken code (each line shows file, line, the original code fragment and the mutated replacement) was NOT caught by the existing tests. For each target, the code currently on disk is the ORIGINAL (correct) code. Write tests that would kill the mutant: choose concrete inputs where the original behavior differs from the mutated replacement, and assert the ORIGINAL behavior with literal expected values. Read the source around the target to understand what the code does.`;

const GUIDANCE_B = `## Your task

targets.jsonl lists uncovered lines: places (file, line) that the existing test suite never executes. Write tests that execute those lines with concrete inputs and assert the observable behavior with literal expected values. Read the source around the target to understand what the code does and how to reach it.`;

const writers = [
  { w: "a1", arm: "A" }, { w: "a2", arm: "A" }, { w: "a3", arm: "A" },
  { w: "b1", arm: "B" }, { w: "b2", arm: "B" }, { w: "b3", arm: "B" },
];
const man = path.join(W, "manifest.jsonl");
fs.writeFileSync(man, "");
for (const { w, arm } of writers) {
  const text = COMMON(w) + "\n" + (arm === "A" ? GUIDANCE_A : GUIDANCE_B) + "\n";
  const p = path.join(W, `${w}.prompt.md`);
  fs.writeFileSync(p, text);
  const sha = crypto.createHash("sha256").update(text).digest("hex");
  fs.appendFileSync(man, JSON.stringify({ writer: w, arm, prompt: `${w}.prompt.md`, prompt_sha256: sha, model: "subagent-default", ts: new Date().toISOString() }) + "\n");
}
console.log("6 writer prompts written + hashed");
