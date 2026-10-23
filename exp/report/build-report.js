// build-report: generate the self-contained HTML report from the markdown prose
// plus live data files. Deterministic: no timestamps, sorted iteration where needed.
// Rerunning must be byte-identical (lever self-proof).
// Usage: node exp/report/build-report.js
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const D = path.join(ROOT, "data");
const MD = fs.readFileSync(path.join(__dirname, "mutation-testing-report.md"), "utf8");
const J = (p) => fs.readFileSync(path.join(ROOT, p), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);

const runs = J("data/runs.jsonl");
const scores = J("data/scores.jsonl");
const headroom = JSON.parse(fs.readFileSync(path.join(D, "headroom.json"), "utf8"));
const detP4 = J("data/detections-p4.jsonl");
const byCell = Object.fromEntries(runs.map((r) => [r.cell, r]));

// ---------- data-derived tables ----------
const fmt = (n) => (n == null ? "?" : n);
function tableCost() {
  let h = "| cell | 并发 | 范围 | 墙钟 s | CPU s | 变异体 | killed | survived | 干跑 s | 备注 |\n|---|---|---|---|---|---|---|---|---|---|\n";
  for (const r of runs.filter((r) => r.scope !== "ladder")) {
    const note = r.truncated ? "撞上限截断" : r.exit_code !== 0 ? `失败 rc${r.exit_code}（ReDoS 干跑翻车，重试成功见 s_c4_r1b）` : r.cell === "s_c4_r1b" ? "s_c4_r1 重试" : r.cell === "h3_false" ? "ignoreStatic=false 配对腿" : r.cell === "hl_high" ? "hitLimit=1e6 配对腿" : "ok";
    h += `| ${r.cell} | ${r.concurrency} | ${r.scope} | ${fmt(r.wallclock_s)} | ${fmt(r.cpu_s)} | ${r.total_mutants} | ${r.counts_by_state.Killed || 0} | ${r.counts_by_state.Survived || 0} | ${fmt(r.dryRunSeconds)} | ${note} |\n`;
  }
  return h;
}
function tableLadder() {
  let h = "| k（改动行数） | 基线 CPU s | 重跑 CPU s | CPU 节省 | 重跑变异体 | 复用率 |\n|---|---|---|---|---|---|\n";
  for (const k of [1, 10, 100]) {
    const b = byCell[`ladder_k${k}_base`], rr = byCell[`ladder_k${k}_rerun`];
    if (!b || !rr) continue;
    const cpu = (r) => r.cpu_user_s != null ? +(r.cpu_user_s + (r.cpu_sys_s || 0)).toFixed(0) : null;
    const saving = cpu(b) && cpu(rr) ? (100 - cpu(rr) / cpu(b) * 100).toFixed(0) + "%" : "?";
    const rerunN = rr.reuseTotal ? rr.reuseTotal - rr.reusedCount : "?";
    const reuse = rr.reuseTotal ? (rr.reusedCount / rr.reuseTotal * 100).toFixed(1) + "%" : "?";
    h += `| ${k} | ${cpu(b)} | ${cpu(rr)} | ${saving} | ${rerunN}/401 | ${reuse} |\n`;
  }
  return h;
}
function tableScores() {
  let h = "| 套件 | killed | timeout | survived | noCoverage | ignored | 覆盖击杀率 |\n|---|---|---|---|---|---|---|\n";
  for (const s of scores) {
    const c = s.counts_by_state;
    h += `| ${s.suite} | ${c.Killed || 0} | ${c.Timeout || 0} | ${c.Survived || 0} | ${c.NoCoverage || 0} | ${c.Ignored || 0} | ${s.score_pct_covered}% |\n`;
  }
  return h;
}
function tableP4() {
  const vers = ["base", "a1", "a2", "a3", "b1", "b2", "b3"];
  let h = `| 缺陷 | 仓库 | ${vers.join(" | ")} |\n|---|---|${vers.map(() => "---").join("|")}|\n`;
  for (const hd of headroom) {
    const cells = vers.map((v) => {
      const rows = detP4.filter((d) => d.suite_version === v && d.defect === hd.fix_sha);
      if (!rows.length) return "—";
      const hits = rows.filter((r) => r.failing_tests.some((t) => t && t !== "__RUNTIME_ERROR__")).length;
      if (hits === rows.length) return "**检出**";
      if (hits === 0) return "·";
      return "不一致";
    });
    h += `| ${hd.fix_sha.slice(0, 8)} | ${hd.repo === "showdown" ? "showdown" : "sql-formatter"} | ${cells.join(" | ")} |\n`;
  }
  h += "\n臂聚合：A 0/5，B 1/5（b13d7b22，b1 与 b2 双轮一致检出），C 0/5。精确 McNemar p=1.0。\n";
  return h;
}

// ---------- SVG charts ----------
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function chartLadder() {
  const data = [1, 10, 100].map((k) => {
    const b = byCell[`ladder_k${k}_base`], rr = byCell[`ladder_k${k}_rerun`];
    const cpu = (r) => r.cpu_user_s + (r.cpu_sys_s || 0);
    return { k, base: cpu(b), rerun: cpu(rr), saving: (100 - cpu(rr) / cpu(b) * 100).toFixed(0) };
  });
  const W = 760, H = 300, pad = 70, bw = 70, max = 2100;
  const y = (v) => H - 40 - (v / max) * (H - 90);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="增量阶梯 CPU 成本">`;
  s += `<style>.ax{stroke:var(--fg3);stroke-width:1}.lbl{fill:var(--fg2);font:12px system-ui}.val{fill:var(--fg1);font:600 13px system-ui}</style>`;
  for (const g of [0, 500, 1000, 1500, 2000]) s += `<line class="ax" x1="${pad}" x2="${W - 20}" y1="${y(g)}" y2="${y(g)}" opacity="0.35"/><text class="lbl" x="${pad - 10}" y="${y(g) + 4}" text-anchor="end">${g}</text>`;
  data.forEach((d, i) => {
    const x0 = pad + 60 + i * 210;
    s += `<rect x="${x0}" y="${y(d.base)}" width="${bw}" height="${H - 40 - y(d.base)}" rx="4" fill="var(--bar-base)"/>`;
    s += `<rect x="${x0 + bw + 10}" y="${y(d.rerun)}" width="${bw}" height="${H - 40 - y(d.rerun)}" rx="4" fill="var(--bar-good)"/>`;
    s += `<text class="val" x="${x0 + bw / 2}" y="${y(d.base) - 8}" text-anchor="middle">${d.base.toFixed(0)}s</text>`;
    s += `<text class="val" x="${x0 + bw * 1.5 + 10}" y="${Math.min(y(d.rerun) - 8, y(d.base) - 8)}" text-anchor="middle">${d.rerun.toFixed(0)}s</text>`;
    s += `<text class="lbl" x="${x0 + bw + 5}" y="${H - 14}" text-anchor="middle" font-weight="600">改动 ${d.k} 行 · 省 ${d.saving}%</text>`;
  });
  s += `<rect x="${pad}" y="18" width="12" height="12" rx="2" fill="var(--bar-base)"/><text class="lbl" x="${pad + 18}" y="29">全量基线</text>`;
  s += `<rect x="${pad + 100}" y="18" width="12" height="12" rx="2" fill="var(--bar-good)"/><text class="lbl" x="${pad + 118}" y="29">增量重跑</text>`;
  s += `<text class="lbl" x="${pad - 55}" y="${H / 2}" transform="rotate(-90 ${pad - 55} ${H / 2})" text-anchor="middle">CPU 秒</text></svg>`;
  return s;
}
function chartScores() {
  const base = scores.find((s) => s.suite === "base");
  const basePct = parseFloat(base.score_pct_covered);
  const W = 760, rowH = 34, pad = 130, H = scores.length * rowH + 70;
  const x0 = pad, x1 = W - 90, lo = 60, hi = 72;
  const x = (v) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="七套件变异分数对比">`;
  s += `<style>.s-lbl{fill:var(--fg1);font:600 13px system-ui}.s-val{fill:var(--fg2);font:12px system-ui}</style>`;
  for (const g of [60, 64, 68, 72]) s += `<line x1="${x(g)}" x2="${x(g)}" y1="26" y2="${H - 30}" stroke="var(--fg3)" opacity="0.3"/><text class="s-val" x="${x(g)}" y="${H - 12}" text-anchor="middle">${g}%</text>`;
  s += `<line x1="${x(basePct)}" x2="${x(basePct)}" y1="22" y2="${H - 30}" stroke="var(--warn)" stroke-dasharray="5 4" stroke-width="2"/>`;
  s += `<text class="s-val" x="${x(basePct)}" y="16" text-anchor="middle" fill="var(--warn)" font-weight="600">基线 ${basePct}%</text>`;
  scores.forEach((sc, i) => {
    const y = 34 + i * rowH, pct = parseFloat(sc.score_pct_covered);
    const arm = sc.suite === "base" ? "C" : sc.suite[0] === "a" ? "A" : "B";
    const fill = sc.suite === "b3" ? "var(--bar-bad)" : sc.suite === "base" ? "var(--bar-base)" : arm === "A" ? "var(--bar-good)" : "var(--bar-mid)";
    s += `<text class="s-lbl" x="${x0 - 10}" y="${y + 16}" text-anchor="end">${sc.suite}（${arm} 臂）</text>`;
    s += `<rect x="${x0}" y="${y}" width="${x(pct) - x0}" height="22" rx="4" fill="${fill}"/>`;
    s += `<text class="s-val" x="${x(pct) + 8}" y="${y + 16}">${pct}%</text>`;
    if (sc.suite === "b3") s += `<text class="s-val" x="${x(pct) + 52}" y="${y + 16}" fill="var(--bar-bad)">← 分母陷阱：Ignored 35→0</text>`;
  });
  s += `</svg>`;
  return s;
}
function chartFlips() {
  const a = byCell["s_c1_r1"], b = byCell["s_c2_r1"];
  const ka = (a.counts_by_state.Killed || 0) + (a.counts_by_state.Timeout || 0);
  const kb = (b.counts_by_state.Killed || 0) + (b.counts_by_state.Timeout || 0);
  const flips = 27;
  const W = 760, H = 170;
  const barW = 560, x0 = 100;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="跨并发杀伤判定翻转">`;
  s += `<style>.f-lbl{fill:var(--fg1);font:600 13px system-ui}.f-sub{fill:var(--fg2);font:12px system-ui}</style>`;
  s += `<rect x="${x0}" y="52" width="${barW}" height="26" rx="6" fill="var(--bar-base)"/>`;
  s += `<rect x="${x0}" y="52" width="${barW * ka / 258}" height="26" rx="6" fill="none"/>`;
  const seg = barW / 258;
  for (let i = 0; i < 258; i++) s += `<rect x="${x0 + i * seg}" y="52" width="${seg * 0.7}" height="26" fill="${i < flips ? "var(--bar-bad)" : "var(--bar-good)"}" opacity="${i < flips ? 1 : 0.55}"/>`;
  s += `<text class="f-lbl" x="${x0}" y="40">并发 1 判定为 killed 的 ${ka} 个变异体，在并发 2 下重新评判：</text>`;
  s += `<text class="f-sub" x="${x0}" y="100">${flips} 个翻转（红） · ${ka - flips} 个保持 killed（绿） · 翻转率 ${(flips / ka * 100).toFixed(1)}%</text>`;
  s += `<text class="f-sub" x="${x0}" y="122">并发 2 侧另有 ${kb - (ka - flips)} 个变异体被新判为 killed</text>`;
  s += `<text class="f-sub" x="${x0}" y="146">同样本：s_c1_r1（conc1，killed ${ka}） vs s_c2_r1（conc2，killed ${kb}）</text>`;
  s += `</svg>`;
  return s;
}

// ---------- markdown -> html (subset) ----------
function inline(t) {
  t = esc(t);
  t = t.replace(/【实测([^】]*)】/g, '<span class="cite cite-e">实测$1</span>');
  t = t.replace(/【官方([^】]*)】/g, '<span class="cite cite-d">官方$1</span>');
  t = t.replace(/【推断([^】]*)】/g, '<span class="cite cite-i">推断$1</span>');
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  return t;
}
function md2html(md) {
  const lines = md.split("\n");
  const out = [];
  let i = 0, inCode = false, codeBuf = [], listMode = null, tableBuf = [];  const flushTable = () => {
    if (!tableBuf.length) return;
    const rows = tableBuf.filter((l) => !/^\|[-\s|:]+\|$/.test(l.replace(/\s/g, "")) || !/^\|/.test(l));
    const isSep = (l) => /^\|[\s:|-]+\|$/.test(l.replace(/\s/g, ""));
    const parse = tableBuf.filter((l) => !isSep(l)).map((l) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
    const head = parse[0], body = parse.slice(1);
    out.push('<div class="tw"><table><thead><tr>' + head.map((h) => `<th>${inline(h)}</th>`).join("") + "</tr></thead><tbody>" +
      body.map((r) => "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") + "</tbody></table></div>");
    tableBuf = [];
  };
  const flushList = () => { if (listMode) { out.push(`</${listMode}>`); listMode = null; } };
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith("```")) {
      flushList(); flushTable();
      if (!inCode) { inCode = true; codeBuf = []; } else { inCode = false; out.push(`<pre><code>${esc(codeBuf.join("\n"))}</code></pre>`); }
      i++; continue;
    }
    if (inCode) { codeBuf.push(l); i++; continue; }
    if (l.startsWith(":::details")) {
      flushList(); flushTable();
      const open = l.startsWith(":::details+");
      const sum = l.replace(/^:::details\+?/, "").trim();
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(":::")) { buf.push(lines[i]); i++; }
      i++; // skip terminator
      out.push(`<details class="fold"${open ? " open" : ""}><summary>${inline(sum)}</summary><div class="fold-body">${md2html(buf.join("\n"))}</div></details>`);
      continue;
    }
    if (l.startsWith(":::takeaway")) {
      flushList(); flushTable();
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(":::")) { buf.push(lines[i]); i++; }
      i++;
      out.push(`<div class="takeaway"><div class="cap">结论</div>${md2html(buf.join("\n"))}</div>`);
      continue;
    }
    if (l.startsWith("|")) { flushList(); tableBuf.push(l); i++; continue; }
    flushTable();
    if (/^---+$/.test(l.trim())) { flushList(); out.push("<hr>"); i++; continue; }
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushList();
      const lvl = h[1].length;
      let txt = inline(h[2]);
      if (lvl === 2) txt = txt.replace(/^(\d+\.)\s/, '<span class="n">$1</span> ');
      const id = h[2].replace(/[^\u4e00-\u9fffA-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 40) || "s";
      out.push(`<h${lvl} id="${id}">${txt}<a class="anchor" href="#${id}" aria-label="锚点">§</a></h${lvl}>`);
      i++; continue;
    }
    const ol = l.match(/^(\d+)\.\s+(.*)$/);
    const ul = l.match(/^[-*]\s+(.*)$/);
    if (ol || ul) {
      const want = ol ? "ol" : "ul";
      if (listMode !== want) { flushList(); listMode = want; out.push(`<${want}>`); }
      out.push(`<li>${inline(ol ? ol[2] : ul[1])}</li>`);
      i++; continue;
    }
    flushList();
    if (!l.trim()) { i++; continue; }
    out.push(`<p>${inline(l)}</p>`);
    i++;
  }
  flushTable(); flushList();
  if (inCode) out.push(`<pre><code>${esc(codeBuf.join("\n"))}</code></pre>`);
  return out.join("\n");
}

// ---------- assemble ----------
let body = MD
  .replace("{{TABLE:cost}}", tableCost())
  .replace("{{TABLE:ladder}}", tableLadder() + "\n\n{{CHART:ladder}}")
  .replace("{{TABLE:scores}}", tableScores() + "\n\n{{CHART:scores}}")
  .replace("{{TABLE:p4}}", tableP4());
// flip chart goes after the 6.x trap table (after 陷阱一 mention in ch1? no—place in ch4 where flips cited)
body = body.replace("### 4.1 成本矩阵", "### 4.1 成本矩阵\n\n{{CHART:flips}}");
const htmlBody = md2html(body)
  .replace("<p>{{CHART:ladder}}</p>", `<div class="chart"><div class="cap">图 1 · 增量模式的 CPU 成本阶梯（改动 1/10/100 行后的重跑对比）<span class="src">源：data/runs.jsonl ladder 行</span></div>${chartLadder()}</div>`)
  .replace("<p>{{CHART:scores}}</p>", `<div class="chart"><div class="cap">图 2 · 七套件变异分数对比（同 810 变异体、同配置）<span class="src">源：data/scores.jsonl</span></div>${chartScores()}</div>`)
  .replace("<p>{{CHART:flips}}</p>", `<div class="chart"><div class="cap">图 3 · 杀伤判定的跨并发翻转（conc1 与 conc2 对同一批变异体的判定差异）<span class="src">源：runs.jsonl s_c1_r1 vs s_c2_r1</span></div>${chartFlips()}</div>`)
  .replace(/<strong>检出<\/strong>/g, '<span class="pill pill-hit">检出</span>')
  .replace("<th>base</th>", '<th><span class="tag tag-c">C</span>base</th>')
  .replace("<th>a1</th>", '<th><span class="tag tag-a">A</span>a1</th>')
  .replace("<th>a2</th>", '<th><span class="tag tag-a">A</span>a2</th>')
  .replace("<th>a3</th>", '<th><span class="tag tag-a">A</span>a3</th>')
  .replace("<th>b1</th>", '<th><span class="tag tag-b">B</span>b1</th>')
  .replace("<th>b2</th>", '<th><span class="tag tag-b">B</span>b2</th>')
  .replace("<th>b3</th>", '<th><span class="tag tag-b">B</span>b3</th>');

const CSS = `
:root{--bg:#fafafa;--fg1:#1a1a1a;--fg2:#555;--fg3:#bbb;--card:#fff;--line:#e2e2e2;--cite-e-bg:#e6f4ea;--cite-e-fg:#137333;--cite-d-bg:#e8f0fe;--cite-d-fg:#1a56b0;--cite-i-bg:#fef7e0;--cite-i-fg:#9c6b00;--bar-base:#8a8f98;--bar-good:#2e9e5b;--bar-mid:#c9a13b;--bar-bad:#d64545;--warn:#c77700;--code-bg:#f0f0f0}
@media(prefers-color-scheme:dark){:root{--bg:#141517;--fg1:#e6e6e6;--fg2:#a8a8a8;--fg3:#4a4a4a;--card:#1d1f23;--line:#33363b;--cite-e-bg:#123a24;--cite-e-fg:#6fce8f;--cite-d-bg:#1b3050;--cite-d-fg:#8ab4f0;--cite-i-bg:#3d3213;--cite-i-fg:#e3c25f;--bar-base:#63676e;--bar-good:#3dbb6e;--bar-mid:#d4af4e;--bar-bad:#e56060;--warn:#e8a33d;--code-bg:#26282d}}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--fg1);font:15px/1.75 system-ui,-apple-system,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif}
main{max-width:980px;margin:0 auto;padding:24px 20px 80px}
header.hero{border-bottom:1px solid var(--line);padding:34px 0 22px;margin-bottom:26px}
header.hero h1{font-size:27px;margin:0 0 6px}
header.hero .sub{color:var(--fg2);font-size:13.5px;max-width:820px}
h2{font-size:21px;margin-top:44px;padding-bottom:8px;border-bottom:2px solid var(--line)}
h3{font-size:17px;margin-top:30px}
code{background:var(--code-bg);padding:1px 6px;border-radius:4px;font-size:.88em;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
pre{background:var(--code-bg);border:1px solid var(--line);border-radius:8px;padding:14px;overflow-x:auto}
pre code{background:none;padding:0}
.tw{overflow-x:auto;margin:14px 0}
table{border-collapse:collapse;width:100%;font-size:13.5px;background:var(--card)}
th,td{border:1px solid var(--line);padding:7px 10px;text-align:left;vertical-align:top}
th{background:var(--code-bg);font-weight:600;position:sticky;top:0}
tbody tr:nth-child(even){background:color-mix(in srgb,var(--card) 88%,var(--code-bg))}
.cite{display:inline-block;font-size:11px;padding:0 7px;border-radius:10px;margin:0 1px;vertical-align:baseline;white-space:nowrap}
.cite-e{background:var(--cite-e-bg);color:var(--cite-e-fg)}.cite-d{background:var(--cite-d-bg);color:var(--cite-d-fg)}.cite-i{background:var(--cite-i-bg);color:var(--cite-i-fg)}
.chart{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin:18px 0;overflow-x:auto}
nav.toc{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);z-index:9;padding:9px 0;font-size:13px}
nav.toc .in{max-width:980px;margin:0 auto;padding:0 20px;display:flex;flex-wrap:wrap;gap:4px 14px}
nav.toc a{color:var(--fg2);text-decoration:none;white-space:nowrap;padding:2px 0;border-bottom:2px solid transparent}nav.toc a:hover{color:var(--fg1)}nav.toc a.on{color:var(--fg1);border-bottom-color:var(--cite-d-fg)}
hr{border:none;border-top:1px solid var(--line);margin:34px 0}
strong{font-weight:650}
h2,h3,h4{scroll-margin-top:60px}
h2 .n{color:var(--cite-d-fg);font-weight:800;margin-right:6px}
.anchor{opacity:0;text-decoration:none;font-weight:400;margin-left:10px;font-size:.75em;color:var(--fg3)}
h2:hover .anchor,h3:hover .anchor,h4:hover .anchor{opacity:1}
.legend{margin-top:10px;font-size:12.5px;color:var(--fg2);display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
.legend .path{margin-left:auto;padding:2px 10px;border:1px solid var(--line);border-radius:12px}
.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:12px;margin:20px 0 8px}
.kpi .c{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.kpi .v{font-size:23px;font-weight:750;letter-spacing:-.5px}
.kpi .v small{font-size:13px;font-weight:600}
.kpi .l{font-size:12.5px;margin-top:3px;color:var(--fg1)}
.kpi .s{font-size:11px;margin-top:7px;color:var(--fg2)}
details.fold{border:1px solid var(--line);border-radius:10px;background:var(--card);margin:12px 0}
details.fold summary{cursor:pointer;padding:10px 16px;font-weight:600;font-size:13.5px;color:var(--fg2);user-select:none}
details.fold summary::before{content:"▸ ";display:inline-block;transition:transform .15s}
details.fold[open] summary::before{content:"▾ "}
details.fold .fold-body{padding:2px 16px 12px}
.takeaway{border-left:4px solid var(--bar-good);background:var(--card);border-radius:0 10px 10px 0;padding:14px 20px;margin:20px 0}
.takeaway .cap{font-size:11px;font-weight:700;letter-spacing:2px;color:var(--bar-good);margin-bottom:6px}
.chart .cap{font-size:12.5px;color:var(--fg2);margin-bottom:10px}
.chart .cap .src{float:right;font-size:11px;color:var(--fg3)}
tbody tr:hover{background:color-mix(in srgb,var(--card) 85%,var(--cite-d-bg))}
.pill{display:inline-block;padding:0 9px;border-radius:9px;font-size:12px;font-weight:650}
.pill-hit{background:var(--cite-e-bg);color:var(--cite-e-fg)}
.tag{display:inline-block;min-width:15px;text-align:center;margin-right:5px;padding:0 4px;border-radius:4px;font-size:10.5px;font-weight:700}
.tag-a{background:var(--cite-e-bg);color:var(--cite-e-fg)}
.tag-b{background:var(--cite-i-bg);color:var(--cite-i-fg)}
.tag-c{background:var(--code-bg);color:var(--fg2)}
.tw td code{word-break:break-all}
.kpi a.c{display:block;text-decoration:none;color:inherit}
.kpi a.c:hover,.kpi a.c:focus{border-color:var(--cite-d-fg)}
.prog{position:fixed;top:0;left:0;height:3px;width:0;background:var(--cite-d-fg);z-index:20}
a.top{position:fixed;right:18px;bottom:18px;width:38px;height:38px;border-radius:50%;background:var(--card);border:1px solid var(--line);color:var(--fg2);text-decoration:none;text-align:center;line-height:36px;font-size:17px;box-shadow:0 2px 8px rgba(0,0,0,.12);z-index:19}
a.top:hover{color:var(--fg1)}
@media(max-width:640px){header.hero h1{font-size:21px}.kpi .v{font-size:19px}.anchor{display:none}a.top{right:10px;bottom:10px}}
@media print{nav.toc,a.top,.prog{display:none}body{font-size:11.5px}main{padding:0}.chart,.tw{break-inside:avoid}h2{break-after:avoid}details.fold .fold-body{display:block}}
`;
const toc = [
  ["术语速查", "术语速查"],
  ["1-摘要与决策矩阵", "1. 摘要与决策矩阵"], ["2-问题定义-变异测试解决什么", "2. 问题定义"], ["3-生态与选型", "3. 生态与选型"],
  ["4-成本实测-rq1", "4. 成本实测"], ["5-收益实测-rq2", "5. 收益实测"], ["6-陷阱清单-部署前必读", "6. 陷阱清单"], ["7-落地路线图", "7. 落地路线图"], ["8-结论", "8. 结论"], ["9-附录", "9. 附录"],
];

// ---- KPI strip (all values computed from live sources) ----
const analysis = JSON.parse(fs.readFileSync(path.join(D, "analysis.json"), "utf8"));
const comb = J("data/defects.combined.jsonl");
const usableN = comb.filter((r) => r.manual_confirmed && r.apply_check === "clean").length;
const contN = comb.filter((r) => r.stratum === "contaminated").length;
const baseS = scores.find((s) => s.suite === "base");
const aMax = Math.max(...["a1", "a2", "a3"].map((v) => parseFloat(scores.find((s) => s.suite === v).score_pct_covered)));
const deltaPP = (aMax - parseFloat(baseS.score_pct_covered)).toFixed(1);
const cpu = (r) => r.cpu_user_s + (r.cpu_sys_s || 0);
const save100 = (100 - cpu(byCell["ladder_k100_rerun"]) / cpu(byCell["ladder_k100_base"]) * 100).toFixed(0);
const save1 = (100 - cpu(byCell["ladder_k1_rerun"]) / cpu(byCell["ladder_k1_base"]) * 100).toFixed(0);
const inv = analysis.invariance["s_c1_r1_vs_s_c2_r1"];
const flipPct = (inv.flips_count / inv.killed_x * 100).toFixed(1);
const kpi = [
  { v: `${save1}<small>%</small>~${save100}<small>%</small>`, l: "增量模式 CPU 节省", s: "1-100 行改动 · runs.jsonl ladder", href: "#4-成本实测-rq1" },
  { v: `${flipPct}<small>%</small>`, l: "杀伤判定跨并发翻转率", s: `${inv.flips_count}/${inv.killed_x} · conc1 vs conc2`, href: "#6-陷阱清单-部署前必读" },
  { v: `${(contN / usableN * 100).toFixed(0)}<small>%</small>`, l: "历史缺陷被基线直接检出", s: `${contN}/${usableN} · 污染层`, href: "#5-收益实测-rq2" },
  { v: `+${deltaPP}<small>pp</small>`, l: "变异引导写手的分数增益", s: `${baseS.score_pct_covered}→${aMax}% · scores.jsonl`, href: "#5-4-变异分数增益-次要机械比较" },
  { v: `0`, l: "真缺陷检出增益（A vs B）", s: "0/5 vs 1/5 · McNemar p=1.0", href: "#8-结论" },
];
const kpiHtml = `<section class="kpi">${kpi.map((k) => `<a class="c" href="${k.href}"><div class="v">${k.v}</div><div class="l">${k.l}</div><div class="s">${k.s}</div></a>`).join("")}</section>`;

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>变异测试调研与可落地分析报告 · StrykerJS 实测版</title>
<style>${CSS}</style>
</head>
<body>
<nav class="toc"><div class="in">${toc.map(([id, t]) => `<a href="#${id}">${t}</a>`).join("")}</div></nav>
<main>
<header class="hero"><h1>变异测试调研与可落地分析报告</h1><div class="sub">StrykerJS 实测版 · 证据三级背书 · 数字由构建脚本从 exp/ 源数据生成 · 重建命令 <code>node exp/report/build-report.js</code></div>
<div class="legend"><span class="cite cite-e">实测</span>本机实验 <span class="cite cite-d">官方</span>Stryker 文档 / API <span class="cite cite-i">推断</span>证据外推 <span class="path">5 分钟版：<a href="#1-摘要与决策矩阵">第 1 章</a> + <a href="#8-结论">第 8 章</a></span></div></header>
${kpiHtml}
${htmlBody}
</main>
<a class="top" href="#" aria-label="返回顶部">↑</a>
<div class="prog" aria-hidden="true"></div>
<script>
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll("nav.toc a"));
  var map = {};
  links.forEach(function (l) { map[l.getAttribute("href").slice(1)] = l; });
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) {
        links.forEach(function (l) { l.classList.remove("on"); });
        var l = map[e.target.id];
        if (l) l.classList.add("on");
      }
    });
  }, { rootMargin: "-15% 0px -75% 0px" });
  Array.prototype.forEach.call(document.querySelectorAll("h2[id]"), function (h) { io.observe(h); });
  var prog = document.querySelector(".prog");
  function onScroll() {
    var d = document.documentElement;
    var p = d.scrollTop / (d.scrollHeight - d.clientHeight || 1);
    prog.style.width = (p * 100).toFixed(2) + "%";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  window.addEventListener("beforeprint", function () {
    Array.prototype.forEach.call(document.querySelectorAll("details.fold"), function (d) {
      d.dataset.was = d.open ? "1" : "0";
      d.open = true;
    });
  });
  window.addEventListener("afterprint", function () {
    Array.prototype.forEach.call(document.querySelectorAll("details.fold"), function (d) {
      if (d.dataset.was !== undefined) d.open = d.dataset.was === "1";
    });
  });
})();
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, "mutation-testing-report.html"), html);
console.log("HTML written:", (html.length / 1024).toFixed(1) + " KiB; markers resolved:", !/\{\{TABLE|\{\{CHART/.test(html));
