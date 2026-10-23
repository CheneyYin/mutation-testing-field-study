// Manual confirmation verdicts for mined defect candidates (P0.5).
// Criteria (preregistered): genuine behavior fix in src/, not
// refactor/docs/test/feat/build/perf, not feature-removal, not
// behavior-identical rewrite, not message-text-only change.
// confirmed: true -> usable candidate. String reason -> excluded.
module.exports = {
  c507070a: true,   // fix(heading): escape sentinels order for raw ids
  "16a434b5": true, // fix(makemarkdown): whitespace between inline elements
  "542405be": true, // fix(event): listeners got live options
  b5d4799c: true,   // fix(email): broken RNG in obfuscation
  "0009cf92": true, // fix(headings): dash-slug line breaks in setext ids
  b13d7b22: true,   // fix(security): --!> comment terminator cm+gfm
  "5f5a14ed": true, // fix(subparsers): event payloads, dead branches
  "081f433b": true, // fix(cmInline): extras inside emphasis
  "9bb0da29": true, // fix(links): strip unused link ref definitions
  "12b616f3": true, // fix(table): header id from raw text
  c987270c: true,   // fix(makehtml): double-processed www autolinks
  "32527831": true, // fix(makehtml): safeMode attribute bypass + ReDoS
  e1d508f1: true,   // fix(blockquote): nesting depth cap
  "668871d7": true, // fix(githubCodeBlock): escape info string
  "718aadbb": true, // fix(footnotes): refs in code spans literal
  "04babdb2": true, // fix(makemarkdown): text-less checkbox list item
  "78b6d49a": true, // fix(makemarkdown): nested list own line
  "15de710a": true, // fix(makemarkdown): checkbox only in list item
  f34b7537: true,   // fix(autolinks): URLs/mentions inside emphasis
  "4fb992cd": true, // fix(link,image): escape quotes in href/src
  e24ca0d9: true,   // fix(autolinks): GFM extended autolink spec
  "92990a14": true, // fix(table): GFM spec alignment
  "17b16b7c": true, // fix(makehtml): fenced-code info strings, lazy setext
  "0d7294dc": true, // fix(cmSpec): generated HTML escaping
  fb28a68d: true,   // fix(image): parseImgDimensions for inline images
  "6fdcca90": true, // fix(cli): batch output dirs, trailing slash
  "245fdb69": true, // fix(commonmark): entities in raw HTML blocks
  "10d83628": true, // fix(commonmark): item fence blank lines keep tight
  "32c4ac1e": true, // fix(commonmark): indented code first block
  f16c35b1: true,   // fix(commonmark): indent-0 closing fence
  "495037af": true, // fix(commonmark): indented code after blockquote
  a552f962: true,   // fix(commonmark): unicode case-fold labels
  "10d76e82": true, // fix(commonmark): backslash escapes in URLs
  d61d16d2: true,   // fix(commonmark): per-list loose/tight nesting
  defbf09f: true,   // fix(commonmark): labels raw source
  "4891ac37": true, // fix(commonmark): lazy continuation bq+list
  "6b46b806": true, // fix(commonmark): setext/thematic-break interference
  "7f23f794": true, // fix(loader): globalThis failover
  "9a4e0baa": true, // fix(subParsers): heading event namespacing (diff verified)
  "32aa9e6d": true, // fix(hashHTMLBlocks): --!> terminator
  // ---- excluded: refactor / docs / test / feat / build / perf ----
  a6632846: "refactor", fc20ad47: "refactor", fc1aaae4: "refactor", b2fc0047: "refactor",
  "66cb26b0": "refactor", ac1ee839: "refactor", "417e2534": "refactor", d88a25a8: "refactor",
  "1a47f7d6": "docs", "0a3d4ec8": "refactor", "88522ce4": "refactor", "1cdcdfe5": "docs",
  cad038a2: "refactor", "494b576b": "refactor", "629c4b08": "refactor", "34e77877": "refactor",
  c42c7512: "feat", "184a3e4e": "feat-adds-hardening", "25b518ef": "test-migration",
  "5a8c464a": "build", "9ec49d95": "feat", "2917ccf7": "feat", "1200139e": "feat",
  "26c753c3": "feat", e55e811e: "feat", "93a0bad1": "feat", dbb3dc4c: "feat",
  f96914c6: "feat", "973a8d6a": "feat", "7d76739c": "feat", "0ee5675a": "feat",
  c25d9ed7: "feat", "695fc422": "feat", "436273a4": "feat", cd5ef8fe: "feat",
  b1e62e1c: "feat", "28363f67": "feat", "38eb9012": "perf", "742dd2e8": "test-move",
  "81795490": "docs", "9db3955e": "test",
  // ---- excluded: fix-labeled but not a behavior defect ----
  "8affebd2": "feature-removal", cdabba2b: "preset-removal", "43f10580": "flavor-tweak",
  "3e02d098": "behavior-identical-collapse", "28cb15d5": "equivalent-rewrite",
  ce94570a: "perf", "6a74eec8": "message-text-only",
};
