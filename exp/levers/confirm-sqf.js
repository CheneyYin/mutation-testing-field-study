// Manual confirmation verdicts for sql-formatter mined candidates (P0 extension).
// Same preregistered criteria as confirm-defects.js.
module.exports = {
  // test-free genuine fixes (headroom candidates)
  "2f9476e1": true, // Don't format COLLATE as statement (Transact-SQL)
  "756d4b75": true, // Fix CREATE SEQUENCE syntax rule
  "79a8b23b": true, // Remove GROUPS from SQLite keywords list
  f6cbe277: true,   // Fix unbalanced parenthesis in DB2i phrases list
  ec6e2505: true,   // Fix bad merge (old nameKw field)
  // mixed commits, genuine fixes (expected contaminated stratum)
  de7587e5: true,   // fix(singlestoredb): % as modulo operator
  aaee3f12: true,   // fix: support pg_dump restrict commands
  eb5bb5ea: true,   // fix: extra space after BETWEEN _ AND _
  "1729b555": true, // fix(sqlite): Tcl-style $param(...)
  "862f7d38": true, // Fix parsing of nested block comments
  "73b58662": true, // Properly detect PostgreSQL TEXT as data type
  edffcbbe: true,   // Treat ASC,DESC as reserved words in sql dialect
  "434d2f8d": true, // Correct JOIN syntax for DB2/DB2i
  a534995c: true,   // fix: E style escape strings for postgresql
  "3986b295": true, // Fix indentation of first comment in file
  "34baa645": true, // Throw error when empty regex in custom param types
  "71387418": true, // Don't treat disable blocks as block-comments
  badf398b: true,   // Don't detect CHAR as function
  c41b2bbf: true,   // Fix capitalization of IS NOT NULL
  "3a1a7a82": true, // Remove multi-word function names from MySQL
  // ---- excluded: feature additions / grammar extensions ----
  "0668f33f": "feature", "9b93a91e": "feature", "8910c5d2": "feature",
  ac92853f: "feature", "911bfb0c": "feature", cd6db252: "feature",
  a6381541: "feature", "772224f5": "feature", "65e7c626": "feature",
  "4eb01937": "feature", "5d377acd": "feature", "678b3e43": "feature",
  "3e0689cc": "feature", cd7ec6cb: "feature", "7f46aa56": "feature",
  // ---- excluded: non-defect ----
  "66c219b1": "cosmetic-whitespace-only (diff verified)",
  de2f2053: "api-export-addition",
  "55c68bb0": "review-refactor",
};
