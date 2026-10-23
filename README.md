# 变异测试实地实验（StrykerJS）

一次对 StrykerJS 变异测试的完整实地研究：跑通了成本矩阵、增量阶梯、ignoreStatic 与 hitLimit 配对实验，并用盲法对照实验检验"存活变异体引导补测试能否提升真实缺陷检出"。全部结论带三级背书（实测 / 官方 / 推断），全部证据经哈希链封存，可逐条复现。

阅读入口（5 分钟版读第 1 章和第 8 章）：

- `exp/report/mutation-testing-report.html` 单文件报告（暗/亮主题，图表与表格由脚本从源数据生成）
- `exp/report/mutation-testing-report.md` 同内容的文本版

核心数字（均由 `exp/levers/analyze.js` 从源数据计算）：

| 发现 | 数字 |
|---|---|
| 增量模式 CPU 节省（1-100 行改动） | 96% 至 91% |
| 杀伤判定跨并发翻转率 | 27/258（10.5%） |
| 历史缺陷被基线套件直接检出（污染率） | 20/26（74%） |
| 变异引导写手的分数增益 | 66.3% 至 69.0%（+2.7pp） |
| 真实缺陷检出增益（A 对 B，预注册判定） | 0/5 对 1/5，McNemar p=1.0，无功效 null |

一句话结论：变异测试是断言强度体检仪，不是缺陷检出增强器。先覆盖率后变异，先诊断后门禁。

## 仓库结构

| 路径 | 内容 |
|---|---|
| `exp/protocol.md` | 预注册实验协议（含全部修正案声明入口） |
| `exp/levers/` | 全部可重放脚本：漏斗、挖缺陷、应用缺陷、差分检出、矩阵、阶梯、评分、审计、报告构建 |
| `exp/data/` | 实验数据：缺陷池、检出记录、运行记录、写手记录、刺激清单、分析产出、manifest 哈希链 |
| `exp/logs/` | 运行日志（矩阵、评分、引导跑、冻结绿灯） |
| `exp/funnel/` | 仓库筛选三段记录 |
| `exp/report/` | 报告文本、HTML 与构建脚本 |

被排除且可复原的内容见 `.gitignore` 注释：两个上游仓的完整克隆、写手沙箱、writer-refs 参考导出。

## 复现

环境基线：8 核 Cortex-A32 共享机、node v24.19.0、StrykerJS 10.0.0。计时段数据来自共享机器，方差声明见报告 4.1。

```bash
# 1) 复原两个冻结仓的运行环境（克隆 + 安装 + Stryker 接入）
bash exp/levers/bootstrap-fresh.sh

# 2) 校验证据哈希链（data/manifest.jsonl 记录的每个产物）
node exp/levers/check-manifest.js

# 3) 重算全部分析表（成本、阶梯、分数、检出矩阵）
node exp/levers/analyze.js

# 4) 从源数据重建报告 HTML（输出与仓内版本字节一致）
node exp/report/build-report.js
```

冻结版本：showdownjs/showdown @ `d1a8d16344b855ea2f37677ee8a9e0cc2c597ea4`（MIT）；sql-formatter-org/sql-formatter @ `223a6ce243fa4f502f1152061f128ef3e652b52d`（MIT）。

检出管线重放（`exp/levers/run-detections.sh`）与写手闸门（`exp/levers/verify-writer.sh`）亦可重跑；后者会自动重建 writer-refs。`data/sd-coverage/` 与 `data/sqf-coverage/` 是覆盖率原始产物，`extract-uncovered.js` 消费它们生成刺激清单。

## 证据纪律

每个论断标注三级来源之一：实测（本仓 jsonl/report 文件，脚本可重算）、官方（Stryker 文档或 GitHub API，URL 见报告 1.4 证据总表）、推断（显式标注）。`data/manifest.jsonl` 以追加式哈希链记录产物指纹（sha256 + 行数 + 阶段），时间戳不作为证据。重放自证记录见报告 9.4：mine-defects 在上游新克隆重跑字节全同，两仓各一个缺陷的检出抽查与记录精确一致。

## 致谢与许可

本仓代码与文本以 MIT 发布（见 LICENSE）。实验对象为两个开源仓（showdown、sql-formatter，均 MIT，冻结 SHA 见上），其代码不随本仓分发，`data/suites/` 中的追加式测试文件保留原始版权头。研究工具为 StrykerJS（Apache 2.0）。报告中引用的官方文档摘录版权归 Stryker 项目所有。
