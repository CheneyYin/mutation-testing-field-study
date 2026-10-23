# 变异测试调研与可落地分析报告

本报告基于一次 StrykerJS 实地实验。论断分三级背书：`【实测】`指本机实验产出，证据位于 `exp/` 下可复现文件，数字由构建脚本从源数据直接生成；`【官方】`指 Stryker 官方文档或 GitHub API，访问日期 2026-10-22，URL 见证据总表；`【推断】`指由前两级证据合理外推，显式标注，不作硬结论。实验协议、数据字典与复现命令见附录。

环境基线【实测：data/runs.jsonl 环境字段】：8 核 Cortex-A32，15G 内存，node v24.19.0，StrykerJS 10.0.0，两仓分别冻结于 d1a8d16（showdown）与 223a6ce（sql-formatter）。机器为共享环境，外部负载均值最高观测到 17-30，全部计时结论附方差声明。

---

## 术语速查

:::details+ 常用术语 18 条（点击收起）
| 术语 | 意思 |
|---|---|
| 变异体（mutant） | 对源码的一处小改动，例如把 `>=` 换成 `>`、把字符串换成空串。每个变异体模拟一个具体缺陷。 |
| 杀死（killed） | 变异体激活时至少一个测试失败，说明套件能区分正确代码和这个缺陷形状。这是想要的结果。 |
| 存活（survived） | 变异体激活时全部测试仍然通过，没有任何断言能发现这个缺陷形状。 |
| 干跑（dry run） | 正式变异前先把原套件完整跑一遍。Stryker 借此确认套件本来全绿、登记全部测试、记录每个测试覆盖了哪些代码。之后每个变异体只跑覆盖它的那部分测试，这是最大的提速来源。 |
| 变异分数 | (killed + timedOut) / total，error 状态不计入分母【官方：D3】。 |
| NoCoverage | 该变异体所在代码没有任何测试执行过，直接按存活计。 |
| timedOut / hitLimit | 变异体造成死循环时，单个测试有执行次数上限，超限按 killed 计。hitLimit 就是这个上限的配置名。 |
| 静态变异体 | 位于模块加载时执行一次的代码（如文件顶层常量）。运行时开关切换不到它，要跑就得为它重建整个测试环境。加载期和测试期都会执行的叫混合静态。 |
| ignoreStatic | StrykerJS 选项。开启后纯静态变异体标记为 Ignored，不跑也不计分。 |
| schemata（变异切换） | 免重编译的激活方式：代码被改写成 `global.activeMutant === '1' ? 变异值 : 原值`，运行时设一次变量即激活一个变异体【官方：D8】。 |
| 并发 worker | Stryker 按配置并行的测试进程数。沙箱只是文件拷贝，worker 之间共享同一个目录【官方：D10】。 |
| 等价变异体 | 改动不改变任何可观察行为（如 `x + 0` 改成 `x - 0`），原理上不可能被杀，官方无检测与标记机制【官方：D7】。 |
| 写手（本实验） | 盲法 LLM 子代理，在无 git、无网的沙箱里按刺激清单补测试。A 臂看存活变异体清单，B 臂看未覆盖行清单，C 臂是冻结套件本身。 |
| 帧（frame，本实验） | 圈定的变异与刺激文件集合：showdown 取 4 个缺陷相关文件，sql-formatter 取 8 个文件。两臂同帧，保证可比。 |
| headroom（本实验） | 冻结套件检不出的历史缺陷，各臂唯一有机会补抓的洞，共 5 个。 |
| 污染层（本实验） | 修复提交自带的回归测试已在套件里，反向应用缺陷后基线立刻检出，没有提升空间，共 20 个。 |
| 差分检出（本实验） | 判定要求两个条件同时成立：带缺陷时失败，无缺陷时通过。一个总是失败的坏测试拿不到分。 |
| killed 集合翻转（本实验） | 同一变异体在不同并发配置下判定相反（killed 变 survived 或反之），来自负载敏感测试。 |
:::end

---

## 1. 摘要与决策矩阵

### 1.1 四问四答

#### 问一：变异测试值不值得引入？
值得。定位是定向补强工具，先不当质量门禁用（理由见 1.3 陷阱一）。它测的是覆盖率测不出的东西：无断言刷覆盖的测试在覆盖率口径满分，在变异口径现形【官方：docs/】。实测中变异引导的写手把变异分数从 66.3% 提到 69.0-69.1%，810 个变异体多杀 17-18 个【实测：data/scores.jsonl】。

#### 问二：怎么上？
按第 7 章四级路线图分阶段上：本地探索 → 夜间批跑 → CI 软门禁 → 硬门禁。硬门禁有四项前置条件（判定稳定性、分母钉死、端口卫生、计时敏感测试预检），全部来自实测踩坑。直接上硬门禁会随机挂掉无辜提交（见 1.3 陷阱一）。

#### 问三：什么时候不上？
三种情况。测试套件本身跑得慢（变异测试成本是套件时长乘以变异体数，套件 2 分钟、400 变异体就是小时级）【实测：runs.jsonl】。集成测试占比高或测试绑端口绑进程（并行 worker 共享目录，冲突产生假击杀）【官方：parallel-workers】【实测：s_c4_r1 干跑翻车】。团队还在追行覆盖率（先用覆盖率找未覆盖区，变异测试的第二阶段才是断言强度）【实测：5.3 节位置彩票发现】。

#### 问四：预算几何？
一次性接入成本 1-2 人日（配置、冒烟、端口预检）。运行成本实测：全量首跑以小时计（showdown 单文件 401 变异体 conc2 需 1183-1315 秒）【实测：runs.jsonl】，增量模式把日常成本压到基线的 4-9%（1/10/100 行改动分别省 96%/95%/91% CPU）【实测：runs.jsonl ladder 行】。夜间批跑 + 增量是性价比配置。

### 1.2 决策矩阵

| 决策场景 | 建议 | 依据强度 | 关键证据 |
|---|---|---|---|
| 引入变异测试提升断言质量 | 是，定向工具定位 | 实测+官方 | A 臂分数 66.3→69.0%【data/scores.jsonl】；官方定位"test your tests"【首页】 |
| 作为 CI 硬门禁（分数不达标即挂） | 否，除非四前置全过 | 实测 | 并发翻转 27/258【runs.jsonl 对比 s_c1_r1 vs s_c2_r1】 |
| 日常开发反馈环内跑 | 否 | 实测 | 单文件 20 分钟级【runs.jsonl s_c2_r1=1183s】 |
| 夜间/发版前批跑 | 是 | 实测 | 增量省 91-96%【runs.jsonl ladder】 |
| 用 ignoreStatic 控成本 | 视文件形状 | 实测 | 纯静态仅 6/48 时节省被噪声淹没【h3_false 配对】；静态密集 helper 6.9s/变异体【m_c2_r1】 |
| 依据 survived 清单直接补测试 | 谨慎，先看覆盖 | 实测 | 位置彩票：headroom 缺陷全在未覆盖区【data/headroom.json + detections-p4.jsonl】 |
| 等价变异体上死磕 100 分 | 否 | 官方+实测 | 官方明示无检测无标记机制【equivalent-mutants】；实测写手 10% 目标为等价体【data/writers.jsonl】 |

### 1.3 陷阱速览（详见第 6 章）

1. 判定不稳定：同配置同套件，并发 1 与并发 2 的 killed 集合差 27 个（10.5%），负载敏感测试（ReDoS 计时断言）在并发下随机翻车。【实测】
2. 分母陷阱：一个动态 import 测试让 35 个 Ignored 变异体涌入分母，分数反降到 64.8%。加测试可以让分数下降。【实测：scores.jsonl b3】
3. 假安慰：regexes.js 变异体全灭（该文件分数满分），但该区域的真实缺陷（`--!>` 终结符）基线漏检。分数满分不等于无缺陷。【实测：sd-guide.report.json + headroom】
4. 等价变异体：官方无解，实测占比约 10% 的引导目标不可杀。100 分不可达是常态。【官方+实测】

### 1.4 证据总表（全部参考依据）

三层证据全部封存于 `exp/data/manifest.jsonl` 哈希链，点击各层展开。附录 9.3 有复现入口。

:::details 官方文档层 D1-D10（Stryker 官方文档，访问 2026-10-22）
| 编号 | 来源 | 关键内容 | 本报告引用处 |
|---|---|---|---|
| D1 | stryker-mutator.io/ | 定位 "Test your tests"；30+ 变异算子；多语言；Apache 2.0；Info Support 支撑 | 1.1、2、3 |
| D2 | stryker-mutator.io/docs/ | 变异测试定义；覆盖率"果酱比喻"；只变异源码不碰测试 | 2 |
| D3 | /docs/General/faq/ | "Stryker is slow!" 列为第一 FAQ；分数公式 (killed+timedOut)/total，error 剔除；状态语义 | 2、4 |
| D4 | /docs/stryker-js/introduction/ | 支持 TS/React/Angular/Vue/Svelte/Node | 3 |
| D5 | /docs/stryker-net/introduction/ | 2018 立项理由".NET 缺好用的变异测试工具" | 3 |
| D6 | /docs/mutation-testing-elements/supported-mutators/ | 16 类算子 30+ 变体，三实现命名对齐 | 2、3 |
| D7 | /docs/mutation-testing-elements/equivalent-mutants/ | 等价体无检测、无标记办法；接受非满分 | 1.3、6 |
| D8 | /docs/mutation-testing-elements/static-mutants/ | schemata 机制；静态体每活一个要全新环境；ignoreStatic 仅 JS 版；.NET 不能忽略默认全跑 | 4、6 |
| D9 | /docs/stryker-js/incremental/ | 6.2 起支持；官方示例 3965 体复用 3731；runner 支持分级表；中断续跑 | 4 |
| D10 | /docs/stryker-js/parallel-workers/ | worker 是进程非线程；沙箱仅文件拷贝共享目录；端口 4444 冲突实例；STRYKER_MUTATOR_WORKER 错开 | 4、6 |
:::end

:::details 生态数据层 G1-G4（GitHub API，2026-10-22）
| 编号 | 来源 | 数据 | 引用处 |
|---|---|---|---|
| G1 | api.github.com/repos/stryker-mutator/stryker-js | 3264★，2016-02 创建，TypeScript，Apache-2.0，2026-10 仍有 push，134 open issues | 3 |
| G2 | api.github.com/repos/stryker-mutator/stryker-net | 2107★，2018-06，C#，2026-10 push，218 open | 3 |
| G3 | api.github.com/repos/stryker-mutator/stryker4s | 217★，2018-06，Scala，2026-10 push，25 open | 3 |
| G4 | api.github.com/repos/infection/infection | 2264★，PHP 生态对标工具，BSD-3 | 3 |
:::end

:::details 实验数据层 E1-E14（exp/ 路径，manifest 哈希链封存）
| 编号 | 证据 | 规模 | 支撑论断 |
|---|---|---|---|
| E1 | funnel/stage1-3.tsv, verdict.md | 21 候选三段筛 | 选仓过程、名气闸门 |
| E2 | data/freeze.md + logs/freeze_green_run*.log | 3174/5885 测试两连绿 | 基线可用性 |
| E3 | data/defects.raw.jsonl + sqf-defects.raw.jsonl | 276+235 挖矿候选 | 缺陷池构造 |
| E4 | data/defects.combined.jsonl | 126 行；headroom 5 / 污染 20 / 无效 2；可用 27 | 污染率 74%、headroom 结构 |
| E5 | data/detections.jsonl | 55 行（P2 基线筛查，两轮差分） | 基线检出、分层 |
| E6 | data/detections-p4.jsonl | 84 行（7 套件 × 6 缺陷 × 2 轮） | A 0/5、B 1/5、C 0/5 |
| E7 | data/runs.jsonl | 19 行（13 矩阵 + 6 阶梯） | 全部成本结论、并发翻转 |
| E8 | data/scores.jsonl | 7 套件分数 | A/B 增益、b3 分母陷阱 |
| E9 | data/sd-guide.report.json + sqf-full.report.json | 810 + 987 变异体 | 引导数据、静态占比 |
| E10 | data/smoke-report.json | 401 变异体、48 静态 | H3 冒烟、91% 时间预警验证 |
| E11 | data/writers.jsonl + writers/verified.jsonl | 6 写手、闸门记录 | 写手产出、等价体占比 |
| E12 | data/stimulus-A/B.jsonl | 各 30 条同框刺激 | 两臂对等性 |
| E13 | data/replay-verification.md + levers/check-manifest.js | 63 产物 0 失败、字节级复现 | 可信度背书 |
| E14 | data/protocol.md | 预注册协议 v2 | 全部修正案留痕 |
:::end

---

## 2. 问题定义：变异测试解决什么

行覆盖率只回答"这行代码被执行过吗"，不回答"执行后有没有被检查"。官方的比喻：三明治覆盖率告诉你面包 80% 涂了酱，变异测试告诉你那是不是巧克力酱【官方：D2】。无断言纯刷覆盖的测试在覆盖率口径满分。

机制上，向源码注入缺陷（变异体），跑既有测试。测试挂则变异体被杀；全绿则存活。存活即存在一个真实缺陷形状，套件抓不住【官方：D2】。变异分数 = (killed + timedOut) / total，error 状态剔除分母【官方：D3】。算子覆盖算术、逻辑、等号边界、布尔、字符串、正则等 16 类 30+ 变体，三实现命名对齐【官方：D6】。

实测对照：我们挖出 26 个历史真实缺陷（反向应用 bugfix 的源码侧），冻结套件对其中 5 个全绿（headroom）【实测：E5】。这 5 个就是变异测试要抓的那类洞。但同样实测表明，存活变异体指引与这些洞的位置错位（见 5.3）。

Stryker 只变异源码、不碰测试【官方：D2】，实现走 mutant schemata：代码改写为 `global.activeMutant === '1' ? 变异值 : 原值`，运行时激活，免每变异体重编译【官方：D8】。

---

## 3. 生态与选型

Stryker 有三个实现【G1-G3】：StrykerJS（3264★，2016 起，十年维护，Apache 2.0，Info Support 公司支撑 + 社区）为旗舰；Stryker.NET（2107★）填补 .NET 空白【官方：D5】；Stryker4s（217★）生态最小。三仓 2026-10 均有活跃 push。PHP 生态对标 Infection 2264★【G4】；Java 的 PIT、Python 的 mutmut 为对应主力（背景知识，本次未验证，标注【推断】）。

JS/TS 侧的 runner 矩阵：Jest、Vitest、Mocha、Jasmine、Karma、Cucumber、Tap 七个专用 runner 加 Command 兜底；Jest/Vitest 的增量支持为 Full 档（测试级精确 diff），Jasmine/Karma 只有测试名【官方：D9】。实测两仓分别用 vitest 与 jest runner 跑通全流程【实测：E7-E9】。

工程适配成本方面有三处需要预检（实测经验）：其一，vite 插件桥接源码的仓需要 `vitest.related=false`（模块图断链致零测试被发现）【实测：logs/stryker-smoke.log】。其二，DisableTypeChecks 预处理器会污染被当作预期输出的 .html 夹具，纯 JS 仓应关掉【实测：同上】。其三，pnpm 管理的仓需从项目外 neutral 目录用钉定 pnpm 版本安装，npm 11 的 devEngines 会拦项目内调用【实测：logs/funnel-stage3.log】。

---

## 4. 成本实测（RQ1）

### 4.1 成本矩阵

{{TABLE:cost}}

读法与方差声明：本机为共享环境，外部负载高峰（load 17-30）期间同配置墙钟摆动极大（conc4 的 498.7s 与 766.7s 是同一工作）。跨并发比较请用 CPU 秒列，墙钟列仅记录不可比。两行失败留痕：s_c4_r1 干跑被 ReDoS 计时断言翻车（重试成功为 s_c4_r1b）；s_c1_r2 撞 2700s 上限截断。

单变异体成本【实测：E7】：小框（1 文件 401 体）conc1 约 4.4s/体，conc2 2.9-3.1s，conc4 1.1-1.8s。外推公式（H1）：总时长 ≈ 干跑时长 + Σ(变异体覆盖测试时长)/有效并行度；有效并行度实测 conc2 ≈ 1.7、conc4 ≈ 2.4（CPU/墙钟），八核只拿到不到三分之一，进程型 worker 的固有开销。

静态变异体的成本要单独算【实测：E7、E10】。冒烟实测 48/401（12%）静态体被 Stryker 预估占 91% 时间，官方因此建议 ignoreStatic【官方：D8】。但配对实验（h3_false 对 s_c2_r1）实测节省为负 183 秒，在噪声范围内。机制拆解：ignoreStatic 只豁免纯静态体（6/48），混合静态体（42/48）走覆盖筛选，覆盖稀薄时很便宜。真正的贵区是被全部 3174 个测试覆盖的静态密集 helper（中框 6.9s/体）【实测：m_c2_r1】。sql-formatter 的 TS 关键字表文件 96% 静态、987 体仅 8 分 50 秒【实测：E9】。结论：ignoreStatic 的收益取决于文件形状，不是通用开关。

hitLimit：默认对 1e6 配对，状态分布零差异，墙钟差在噪声带内【实测：E7 hl_high】。本规模无可测效应。

### 4.2 增量模式的成本阶梯

{{TABLE:ladder}}

改动阶梯实测（仅注释行、哈希验证回退）【实测：E7 ladder 行】：1 行改动重跑 6/401 变异体（CPU 省 96%），10 行 18/401（95%），100 行 48/401（91%）。约每改动行 0.5 个重跑体。官方口径的复用判定（killed 的 culprit 测试未变则复用等）与此吻合【官方：D9】。接入增量后，变异测试的边际成本随改动规模走，不随仓库规模走，夜间批跑因此可行。

---

## 5. 收益实测（RQ2）

### 5.1 缺陷池与污染率

26 个有效反向应用缺陷中，20 个（74%）被冻结基线套件直接检出【实测：E4/E5】。机制：成熟仓库的修复提交自带回归测试，测试在 HEAD 里，反向应用源码侧后测试即挂。这一污染率与实验设计阶段三位独立审阅模型的预测一致（对照记录见 data/protocol.md 修正案）。含义：成熟仓库里"历史缺陷"大多已不是变异测试的靶子；靶子是从未有过测试的代码。

### 5.2 写手对照实验（预注册判定）

六名盲法沙箱写手（A 臂 3 人看存活变异体清单、B 臂 3 人看未覆盖行清单、同 30 条目标、同 12 测试块上限、互相不知缺陷清单），对 5 个 headroom 缺陷的差分检出：

{{TABLE:p4}}

预注册判定：统计上无功效的 null。A 0/5，B 1/5，C 0/5，精确 McNemar p=1.0。headroom n=5 时只有 6:0 全灭式差距才可能显著（预注册功效算术，protocol.md）。如实报区间，不下强制结论。唯一被检出的缺陷（`--!>` 注释终结符）由 B 臂两名独立写手抓住【实测：E6】。

### 5.3 三个机制发现

#### 发现一：位置彩票
headroom 缺陷全部住在未覆盖代码里。A 臂刺激限定 state=Survived，而未覆盖区的变异体是 NoCoverage，存活引导在结构上指不到那里；B 臂的未覆盖行引导恰好指过去。A-B 之差是引导地理与缺陷地理的错位，不是写手能力差【实测：E12 + data/sd-uncovered.jsonl + E6】。

#### 发现二：满分假安慰
`--!>` 缺陷所在的 regexes.js，其全部变异体在引导跑中已被杀灭（该文件分数满分），故 A 臂刺激根本不含该文件；真缺陷却在。变异分数满分的区域仍可能有缺陷：分数只衡量套件对已生成变异体的断言强度，这些算子没生成到的缺陷形状它管不到【实测：E9 + E4】。

#### 发现三：b3 分母陷阱
B 臂写手 b3 的一个动态 import 测试在测试运行期重新执行了模块加载代码，Stryker 的静态判定全部失效：35 个 Ignored 变异体涌入分母、其中 26 个存活，分数 64.8% 低于基线 66.3%。复跑确认可复现，非负载噪声。加一个测试可以让变异分数下降，且分母构成静默改变【实测：E8 b3 行，Ignored=0】。

### 5.4 变异分数增益（次要机械比较）

{{TABLE:scores}}

A 臂三写手 69.0/69.1/69.0% 对基线 66.3%，各多杀 17-18 个存活变异体；B 臂 b1/b2 与基线完全持平（零新增击杀：覆盖引导的测试全落在已覆盖已杀灭区）【实测：E8】。A 臂写手自报对刺激目标的击杀 27/30、28/30、26/30，各自识别出 2-4 个等价变异体（约 10% 引导目标不可杀）【实测：E11】。解读要克制：A 优化了它被引导的指标，这正是 5.3 发现一所警示的自循环风险；真缺陷检出上 A 与 B 无统计差异。

---

## 6. 陷阱清单（部署前必读）

| # | 陷阱 | 机制 | 实测证据 | 检测/规避 |
|---|---|---|---|---|
| 1 | 判定跨并发翻转 | 负载敏感测试（计时/端口断言）在并行 worker 下行为改变 | killed 集合 conc1 vs conc2 差 27/258；ReDoS 干跑 4 次翻车 | 跨并发跑 killed-set 不变性检查；计时断言测试预检；CI 上锁并发数 |
| 2 | 分母静默改变 | 动态 import 让模块加载代码在测试期执行，静态判定失效 | b3：Ignored 35→0，分数反降 | 分数门禁必须钉死套件模块加载行为；对比时校验 Ignored 计数一致 |
| 3 | 满分假安慰 | 分数只度量已生成变异体的断言强度 | regexes.js 全灭但真缺陷漏检 | 分数之外保留覆盖率交叉视图；未覆盖区先补覆盖再谈断言 |
| 4 | 等价变异体 | 语义不变的变异不可杀 | 写手 10% 目标为等价体；Math.imul 死代码缺陷反向应用零行为差异 | 接受非满分；设阈值而非 100；官方亦明示无解 |
| 5 | gitignored 生成物 | 沙箱/克隆缺生成文件（grammar.ts、.build/），套件行为改变 | sql-formatter 幻影缺陷；CLI 测试翻车 | 接入前盘点 gitignored 运行时依赖；管线显式重建 |
| 6 | export-ignore 沙箱 | .gitattributes 的 export-ignore 让 git archive 丢 test/ 与 scripts/ | 六写手沙箱残缺被迫各自重建 | 沙箱导出用 git ls-files 而非 git archive |
| 7 | 符号链接 node_modules | Stryker 沙箱复制把 symlink 变空目录 | score-scratch 全灭三连 | 评分/检测在冻结仓内覆盖-复原，或用真实目录 |
| 8 | 端口/进程冲突 | worker 共享目录，绑端口测试互撞产生假击杀 | 官方 4444 实例【D10】 | 端口预检 grep；STRYKER_MUTATOR_WORKER 错开端口 |
| 9 | 陈旧 dist 自引用 | package.json exports 指向 dist，测试绑到陈旧构建而非活源码 | 六写手测试全部误绑（本实验修复后重验） | 测试导入走源码桥（virtual:showdown 模式）；CI 加 dist 新鲜度检查 |

---

## 7. 落地路线图

### 7.1 四级采用

#### L1 本地探索（第 1 周）
工程师本地 `npx stryker run --mutate <改动文件>` 看存活清单。无流程改动，纯信息增量。配置模板见 7.2。前置：跑通一次全量（获得基线分数与静态体 census）。

#### L2 夜间批跑（第 2-4 周）
增量模式 + 固定并发数 + ignoreStatic 视文件形状。产物只进报告不进门禁。团队建立"存活清单分类"的手感：可杀（补断言）、等价（标记忽略）、不划算（记录跳过）。

#### L3 CI 软门禁（第 2 月）
分数下降在新 PR 上打标签但不阻塞；翻转与分母变化自动归因（比较 counts_by_state 而非只看总分）。此阶段收集判定稳定性数据。

#### L4 硬门禁（数据背书后）
四项前置全部满足才准上：
1. 连续 4 周跨并发 killed-set 翻转率 < 1%（本实验基线 10.5%，来自计时敏感测试）；
2. 分母钉死：Ignored 计数在相邻运行间零漂移（防陷阱 2）；
3. 端口卫生预检通过且 CI 并发数锁定（防陷阱 1/8）；
4. 阈值定在实测分布的 P5 而非 100（防陷阱 4）。
任一不满足则停留在 L3。

### 7.2 配置模板

vitest 仓（showdown 型，验证可用）：

```json
{
  "testRunner": "vitest",
  "reporters": ["clear-text", "json"],
  "jsonReporter": { "fileName": "reports/stryker.json" },
  "mutate": ["src/**/*.js"],
  "vitest": { "related": false },
  "disableTypeChecks": false,
  "concurrency": 2,
  "timeoutMS": 5000,
  "ignoreStatic": true,
  "incremental": true
}
```

注：`vitest.related=false` 为 vite 插件桥接仓所需；`disableTypeChecks=false` 防夹具污染（纯 JS 仓）。react/vue 仓按需调整。并发数按 CI 容器核数定，锁定后不漂移。

jest 仓（sql-formatter 型，验证可用）：

```json
{
  "testRunner": "jest",
  "reporters": ["clear-text", "json"],
  "jsonReporter": { "fileName": "reports/stryker.json" },
  "mutate": ["src/**/*.ts", "!src/**/grammar.ts"],
  "concurrency": 4,
  "timeoutMS": 5000,
  "ignoreStatic": true,
  "incremental": true
}
```

注：排除生成物（grammar.ts）；pnpm 仓需确保 jest-environment-node 顶层可解析。

### 7.3 运行预算参考（外推自实测，标注【推断】）

100 文件中型 TS 仓、套件 90 秒、约 8000 变异体：全量首跑约 6-9 小时（8 核 conc2-4）；接入增量后日常 <30 分钟。两条纪律：一是先把套件时长压进 2 分钟（变异成本与其线性相乘）【实测比例关系】；二是 CI 容器核数与本地一致，否则分数不可比【实测：并发翻转】。

---

## 8. 结论

值得引入，但只以定向诊断工具的形态，且先解决两个前提；本实验未支持它作为质量门禁或真缺陷检出增强器的用法。

成本侧理想。增量模式把日常开销压到基线的 4-9%（1/10/100 行改动省 96%/95%/91% CPU），边际成本随改动规模走【实测：runs.jsonl ladder】；静态密集的纯数据文件很便宜（987 体 8 分 50 秒）【实测：E9】；断点续跑可用。

质量侧不理想。预注册主判定为无功效的 null（A 0/5，B 1/5，p=1.0）【实测：E6】，且机制证据偏向结构性负面：headroom 缺陷全部住在未覆盖区，存活变异体指引的恰好是已覆盖但断言弱的区域，引导地理与缺陷地理错位【实测：E4/E12】；变异分数满分区域藏着基线漏检的真缺陷【实测：E9】；唯一被检出的缺陷由覆盖引导抓住。分数从 66.3% 提到 69.0-69.1% 是写手对着被引导指标补断言的直接回报，自循环成分高，它证明的是诊断能力（哪里断言弱），不是缺陷检出增益。

### 引入方式

按 7.1 路线图走：L1 本地探索起步，L2 增量夜间批跑，L3 CI 软门禁，L4 硬门禁等四项前置实测达标（跨并发翻转率 <1%、Ignored 计数零漂移、端口预检、阈值定 P5）。测试套件超过 2 分钟或集成测试占比高的团队先解决套件速度，再谈接入。

### 放弃的预期

三样：分数当硬门禁（判定跨并发翻转 10.5%【实测：E7】）；拿存活清单直接指导补测试去抓真缺陷（先看覆盖）；死磕 100 分（约 10% 引导目标为等价体【实测：E11】）。

:::takeaway
变异测试是断言强度体检仪，不是缺陷检出增强器。它最可靠的产出是"哪里断言弱"的清单和省 91-96% 的增量管线；它管不到变异算子没生成到的缺陷形状，也指不到从未被测试过的代码。先覆盖率后变异，先诊断后门禁。
:::end

---

## 9. 附录

### 9.1 实验协议要点（预注册，全修正案见 data/protocol.md 与 data/status.md）

主判定 A 对 B 精确 McNemar；检出为差分定义（带缺陷失败且无缺陷通过）；缺陷池 P2 筛查分层（headroom/污染/无效）；写手盲法沙箱（无 git、无网、工具日志审计）；数据形状先于脚本冻结；检查点为哈希链而非时间戳。修正案共 14 条，全部留痕。

### 9.2 数据字典

| 文件 | 键 | 说明 |
|---|---|---|
| data/runs.jsonl | cell, conc, scope, wall/cpu, counts_by_state, staticCount, dryRunSeconds, reusedCount | 每行一次 Stryker 运行 |
| data/defects.combined.jsonl | fix_sha, repo, src_paths, manual_confirmed, apply_check, stratum | 缺陷池与分层 |
| data/detections(-p4).jsonl | defect, suite_version, round, exit_code, failing_tests | 差分检出记录 |
| data/scores.jsonl | suite, counts_by_state, score_pct_covered | 臂后分数 |
| data/writers.jsonl + writers/verified.jsonl | writer, arm, blocks, 闸门结果 | 写手会话 |
| data/stimulus-A/B.jsonl | arm, file, line, kind | 冻结刺激 |

### 9.3 复现入口

```bash
node exp/levers/check-manifest.js   # 哈希链校验（63 产物，0 失败）
node exp/levers/analyze.js          # 全部分析表重算
node exp/report/build-report.js     # 本报告 HTML 从源数据重建
bash exp/levers/run-detections.sh   # 检出管线（含树复位断言）
```

### 9.4 重放自证结果【实测：E13】

manifest 哈希链 90 条记录 63 个产物，校验 0 失败（56 精确 + 7 追加超集语义）。mine-defects 在上游新克隆重跑字节全同（276 候选，上游 HEAD 未移）。两仓各一个缺陷的检出抽查：失败测试名与记录精确一致（12b616f3、de7587e5）。base 分数与引导跑仅 1 个 Killed/Timeout 翻转（已知负载敏感）。写手窗口审计：零网络、零 git、零答案文件读取。

### 9.5 局限声明

单机共享环境，计时结论带方差声明；两仓均为中小型解析器/格式化器库，结论外推到大型应用需谨慎【推断】；写手为 LLM 子代理，成本口径是轮次与 token 而非人时【实验设计声明】；headroom n=5 的统计功效不足为主判定的既定约束；语言覆盖 JS/TS，.NET 与 Scala 仅文献口径【官方】。
