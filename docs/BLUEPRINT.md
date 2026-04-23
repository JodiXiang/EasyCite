# EasyCite MVP Blueprint

## 1. 产品 PRD

### 产品一句话定义

EasyCite 是一个 Google Docs 里的轻量级 AI citation copilot：用户写作时选中一句话或输入关键词，系统即时检索可信 scholarly sources，用户确认后，一键插入文内引用并维护文末 References。

### 用户画像

- 研究生、博士生、博士后：正在写论文、proposal、literature review，需要快速补引用。
- 学术写作者、research analyst：写作过程中需要用 DOI / title / keywords 快速找到可引用来源。
- 早期目标用户：不想维护 Zotero/Paperpile 文献库，只想在 Google Docs 写作流里即时解决“这句话该引用谁”。

### 核心使用场景

- 用户写到一句 claims，例如 “Transformer-based models have improved long-context reasoning.”
- 用户选中这句话，点击 `Find citation`。
- 系统从句子和周边段落构造检索 query，返回 3-5 篇候选论文。
- 用户阅读标题、摘要、相关性解释、链接，选择一篇。
- 系统插入 `(Author, Year)` 或 `[1]`，并在文末创建/更新 References。

### 用户痛点

- 写作和检索上下文切换频繁。
- 手动判断论文是否相关成本高。
- citation style 和 bibliography 容易漏、重复、格式不一致。
- 重型 reference manager 要先建库，不适合临时补引用。

### MVP 功能范围

- Google Docs 侧边栏/菜单入口。
- 根据选中句子或当前光标句子找文献。
- 手工输入标题、DOI、关键词搜索。
- 返回 3-5 个候选 paper cards。
- 用户确认后插入 in-text citation。
- 支持 APA author-year 与数字制 numeric 两种 style。
- 文末 References 自动创建/更新。
- 对同一篇 paper 去重，避免 bibliography 重复条目。
- 后端保存 document-level citation state；MVP demo 用 `DOCUMENT_STORE_PATH` 指向 JSON 文件持久化，后续可平滑迁到 SQLite/PostgreSQL。

### 明确不做什么

- 不做用户文献库、收藏夹、标签系统。
- 不做 PDF 管理、PDF 阅读器、全文批注。
- 不做 Word 插件。
- 不做团队协作、共享 library、复杂权限。
- 不做完全自动盲插 citation。
- 不做付费商业数据库集成。
- 不做复杂 CSL 全量兼容，MVP 只实现两种 style 的可用 formatter。

### 成功指标

- Demo 成功率：完整闭环 `选中句子/输入关键词 -> 候选 -> 选择 -> 插入 citation -> 更新 References` 成功率 >= 90%。
- Time-to-citation：从触发到插入引用 < 20 秒。
- Candidate usefulness：前 5 个结果中至少 1 个用户认为可引用的比例 >= 70%。
- Bibliography correctness：重复引用同一 DOI 不重复生成 reference 的比例 >= 95%。
- Activation：首次安装后 10 分钟内完成第一条 citation 的用户比例。

## 2. 用户流程

### Flow A：按语境找文献

1. 用户在 Google Docs 中选中一句话，或把光标放在一句话内。
2. 用户点击顶部菜单 `EasyCite -> Find citation`，或在 sidebar 点击 `Find for selected text`。
3. Apps Script 读取 selected text；如果没有 selection，则读取当前段落并交给后端抽取句子。
4. 前端显示 loading：`Searching scholarly sources...`。
5. 后端执行 query construction，调用 OpenAlex / Crossref / Semantic Scholar 等免费源。
6. API 返回 3-5 篇候选论文。
7. 每篇显示 title、authors、year、venue/source、摘要、为什么相关、DOI/URL 链接。
8. 用户点击 `Open` 查看来源页面，或点击 `Insert citation`。

### Flow B：插入引用

1. 用户在候选文献中选择一篇。
2. 用户在 style selector 选择 `APA` 或 `Numeric`。
3. Sidebar 调用 Apps Script `insertCitation(paper, style)`。
4. Apps Script 在当前光标位置插入 in-text citation。
5. Apps Script 调用后端保存 document citation state。
6. 后端 dedupe paper，返回 document bibliography。
7. Apps Script 在文末查找 `References` / `Bibliography` managed block。
8. 如果不存在，则创建 managed block；如果存在，则重写 managed block 内容。
9. 重复引用同一 DOI / normalized title 时，正文仍可插入 citation，但 bibliography 只保留一个 entry。
10. 未来切换 style 时，系统基于 document citations 重新生成正文 citation 和 bibliography；MVP 先在架构上保留接口。

## 3. 技术方案建议

### 推荐 MVP 架构

- Google Docs integration：Google Apps Script Editor Add-on 风格的 sidebar + custom menu。优点是最快跑通文档读写，不需要 Chrome extension 权限复杂度。
- Frontend：Apps Script HTML sidebar。MVP 不强依赖 Next.js；如果需要官网/管理页，再加 Next.js。
- Backend：Node.js + Express + TypeScript REST API。
- DB：MVP demo 先用 JSON 文件持久化 document citation state，schema 保持 SQLite/PostgreSQL 可迁移。上线后换 SQLite 或 Postgres。
- Retrieval：OpenAlex 优先，Crossref DOI/title 补全，Semantic Scholar 作为可选增强。
- Citation formatting：先写自有 formatter，支持 `apa` 和 `numeric`；后续替换/接入 citeproc-js + CSL。

### 文档读写

- Apps Script 使用 `DocumentApp.getActiveDocument()`。
- Selection：用 `getSelection()` 尽量读取选中文本；无 selection 时读取 cursor 所在 paragraph。
- 插入 citation：cursor 位置 `insertText()`；无 cursor 时插入到当前 selection 末尾。
- References block：在文档末尾维护一个清晰 marker。

Markers:

```text
References
<!-- CITEPILOT_REFERENCES_START -->
...
<!-- CITEPILOT_REFERENCES_END -->
```

Google Docs 对 HTML 注释不是原生文档结构，Apps Script 里可使用纯文本 marker，例如：

```text
[CITEPILOT_REFERENCES_START]
[CITEPILOT_REFERENCES_END]
```

### Bibliography 状态维护

- 后端以 `googleDocId + style` 维护 document state。
- 每次插入 citation 时 upsert paper，然后 append document citation。
- bibliography 由后端基于 document citations 重新生成。
- Apps Script 只负责把后端返回的 formatted bibliography 写回文档。

### Metadata 存储

- Paper 用 canonical key 去重：优先 DOI lowercase；否则 OpenAlex ID；否则 normalized title + year。
- 保留 raw source payload，方便 debug 和未来扩展。
- Authors 结构化存储为数组，MVP 可以 JSON string 存 SQLite。

### Authentication

- MVP 本地 demo：不做用户系统，使用 Apps Script 调用 API。
- 轻量上线：Google Apps Script 可传 `Session.getActiveUser().getEmail()` 作为 `userEmail`；后端仅做 allowlist/API key。
- 正式版：Google OAuth + Workspace Add-on scopes，但不是首周必要项。

### REST API

- `POST /api/search/context`：根据 selected text/context 查文献。
- `POST /api/search/manual`：根据 DOI/title/keywords 查文献。
- `POST /api/documents/:docId/citations`：插入/记录 citation，返回 formatted citation + bibliography。
- `GET /api/documents/:docId/bibliography?style=apa`：读取 bibliography。
- `POST /api/documents/:docId/reformat`：预留 style switch。

## 4. 文献检索方案

### 两种搜索方式

- 语境搜索：输入 selected sentence + optional surrounding paragraph。
- 手工搜索：输入 DOI、标题、关键词。

### Query Construction

语境搜索：

- 清洗文本，去掉 citation-like tokens。
- 抽取 5-8 个关键词：名词短语、专有名词、技术术语。
- 保留原句中的强约束词，例如模型名、方法名、疾病名、数据集名。
- 构造 2-3 条 query：
  - exact-ish：核心术语组合。
  - broad：领域词 + claim 动词。
  - title/abstract search：原句压缩版。

MVP 可以先用简单规则，不必第一天接 LLM：

- lower-case normalize。
- 去停用词。
- 取最长/最罕见 tokens。
- 如果有 DOI regex，直接 DOI lookup。

### 排序候选结果

Score = semantic/title relevance + recency/source quality + metadata completeness + citation count signal。

MVP 实现：

- 标题/摘要 token overlap。
- 年份加权但不过度偏新。
- 有 DOI 加分。
- 有 abstract 加分。
- OpenAlex cited_by_count 加轻量加分。

### 去重

- DOI 相同直接合并。
- OpenAlex ID 相同合并。
- normalized title Levenshtein/Jaccard 高相似且年份相同则合并。
- 多源合并时 Crossref 补 DOI/venue，OpenAlex 补 abstract/citation count。

### 元数据不完整

- 无摘要：显示 `No abstract available from source`，不伪造。
- 无 venue：显示 source name 或 `Unknown source`。
- 无 DOI：保留 URL/OpenAlex ID，并降低可信度。
- 作者过多：显示前 3 位 + `et al.`。

### 降低 hallucination 风险

- 不让 LLM生成论文元数据；元数据必须来自 retrieval source。
- `why relevant` 可以由规则或 LLM基于已返回 title/abstract 生成，但必须标注基于摘要判断。
- 每张卡展示 source link/DOI。
- 如果 source metadata 不足，明确提示。

### 免费可行数据源

- OpenAlex：首选，免费、覆盖广、支持 works search。
- Crossref：DOI/title metadata 补全，适合 bibliography。
- Semantic Scholar API：可选，摘要和 citation signals 较好，但注意 rate limit。
- PubMed：未来面向 biomedical 可以加。
- arXiv：未来面向 CS/physics 可以加。

## 5. 引用格式与数据模型

### Paper

```ts
type Paper = {
  id: string;
  canonicalKey: string;
  title: string;
  authors: Author[];
  year?: number;
  doi?: string;
  url?: string;
  venue?: string;
  abstract?: string;
  source: "openalex" | "crossref" | "semantic_scholar" | "mock";
  sourceIds: Record<string, string>;
  citedByCount?: number;
  raw?: unknown;
};
```

### Document Citation

```ts
type DocumentCitation = {
  id: string;
  documentId: string;
  paperKey: string;
  style: "apa" | "numeric";
  citationNumber?: number;
  insertedText: string;
  anchorId?: string;
  createdAt: string;
};
```

### Bibliography Entry

```ts
type BibliographyEntry = {
  paperKey: string;
  style: "apa" | "numeric";
  order: number;
  formattedText: string;
};
```

### Dedupe Logic

- `doi:${lowercaseDoi}` 优先。
- `openalex:${id}` 次优先。
- `title:${normalizedTitle}:${year}` fallback。

### Style 扩展

- formatter 接口固定：`formatInTextCitation(paper, context)` 和 `formatBibliographyEntry(paper, order)`。
- 新增 style 时只新增 formatter module。
- document state 保存 paper metadata，不保存单一格式文本作为唯一来源。

## 6. MVP 页面与组件

### Google Docs 入口

- Custom menu：`EasyCite -> Open sidebar`
- Custom menu：`EasyCite -> Find citation`
- Sidebar primary button：`Find for selected text`

### 组件清单

- `SidebarApp`：整体状态容器。
- `SearchBox`：支持手工输入标题/DOI/关键词。
- `ContextSearchButton`：读取 selected text 并搜索。
- `StyleSelector`：APA / Numeric。
- `CandidateList`：结果列表。
- `PaperCard`：title、authors、year、venue、abstract、why relevant、open link、insert button。
- `BibliographyStatus`：显示 `References ready` / `Updated 3 entries` / error。
- `LoadingState`：检索中、插入中。
- `EmptyState`：无结果，引导换关键词。
- `ErrorState`：API 错误、Google Docs 权限错误。

## 7. 代码仓库结构

```text
apps/
  api/                Node.js REST API
  docs-addon/         Google Apps Script sidebar and document operations
packages/
  citation-core/      shared types, formatter, dedupe, normalization
docs/
  BLUEPRINT.md        product and engineering plan
scripts/
  seed.ts             future local fixtures
```

## 8. 分阶段开发计划

### Phase 0：跑通最小 demo

- 目标：不用真实检索，mock 结果，能在 Docs 插入 citation 和 References。
- 交付物：Apps Script sidebar、mock `/api/search/manual`、insert citation、references block。
- 风险：Google Docs selection/cursor API 行为不稳定。
- 验收标准：输入关键词，显示 mock paper，点击后正文出现 citation，文末出现 References。

### Phase 1：Google Docs 中手动搜索并插入 citation

- 目标：接入真实 OpenAlex/Crossref manual search。
- 交付物：manual search API、paper card、dedupe bibliography。
- 风险：API rate limit、metadata 缺失。
- 验收标准：搜索 DOI/title/keyword 返回真实论文，插入后 bibliography 格式基本正确。

### Phase 2：根据语境推荐文献

- 目标：选中句子后推荐相关论文。
- 交付物：context extraction、query construction、ranking、why relevant。
- 风险：query 太宽导致结果不相关。
- 验收标准：对 10 个测试句子，至少 7 个能在前 5 返回可接受候选。

### Phase 3：bibliography 自动维护和样式切换

- 目标：APA / Numeric bibliography 稳定生成，预留 reformat。
- 交付物：document citation state、style formatter、reformat endpoint stub。
- 风险：正文中已插入 citation 的定位和替换较难。
- 验收标准：重复引用同一 paper 不重复 bibliography；切 style 后 bibliography 可重写。

### Phase 4：增强可信度与去重

- 目标：多源合并、可信度提示、metadata 补全。
- 交付物：Crossref enrichment、confidence indicators、dedupe reports。
- 风险：多源冲突处理复杂。
- 验收标准：DOI/title duplicate 合并准确；无 DOI 结果有明确可信度提示。

## 9. 代码骨架

当前仓库已生成可开工 skeleton：

- `apps/api/src/server.ts`：Express app。
- `apps/api/src/routes/search.ts`：manual/context search endpoints。
- `apps/api/src/routes/documents.ts`：document citation endpoints。
- `apps/api/src/services/retrieval.ts`：OpenAlex + mock retrieval。
- `apps/api/src/services/documentStore.ts`：MVP in-memory document state。
- `apps/docs-addon/src/Code.ts`：Google Docs menu/sidebar/document mutation。
- `apps/docs-addon/src/Sidebar.html`：最小 sidebar UI。
- `packages/citation-core/src/*`：types、dedupe、formatter。

### 先 mock 的地方

- 搜索失败或未配置时 fallback mock papers。
- DB 先用 in-memory，接口按未来 SQLite/Postgres 设计。
- `whyRelevant` 先用 token overlap 规则生成。

### 必须真实实现的地方

- Google Docs 插入 citation。
- References block 创建和更新。
- DOI/title/keyword 至少接一个真实 scholarly source。
- Dedupe canonical key。
- APA/Numeric formatter。

## 10. 编码执行方式

- 先实现 API 和 Apps Script 的最短链路，不先做漂亮 UI。
- 所有 paper metadata 必须来自 source response 或 mock fixture，不让 AI 编造。
- 先让 bibliography 每次全量重写，避免局部更新复杂度。
- document state 先保存在后端，后续可加 Docs Properties 作为 fallback。
- 命名统一使用 `paper`, `citation`, `bibliography`, `documentId`, `canonicalKey`。

## 最小 demo user story

作为一个正在 Google Docs 写 introduction 的研究生，我选中句子 “Large language models can perform in-context learning from examples in the prompt.”，点击 `Find citation`，看到 5 篇候选论文。我选择 Brown et al. 2020，点击 `Insert citation`，正文插入 `(Brown et al., 2020)`，文末 References 自动新增该论文条目。再次引用同一论文时，References 不重复。

## 首周开发 TODO checklist

- 创建 API skeleton 和 shared citation package。
- 创建 Apps Script sidebar 和 menu。
- 跑通 mock search -> insert citation -> update References。
- 接 OpenAlex manual search。
- 实现 DOI/title canonical dedupe。
- 实现 APA 和 Numeric formatter。
- 加 10 条 context query regression examples。
- 写 `.env.example` 和本地运行说明。
- 录制一个 60 秒 demo。

## 最容易失败的 5 个风险点

- Google Docs selection/cursor API 在复杂文档中插入位置不稳定。
- 语境 query 太泛，候选结果看起来“相关但不可引用”。
- 免费数据源摘要缺失，导致用户难以判断。
- citation style 的边界情况多，手写 formatter 容易不完整。
- 文档内已插入 citation 的 reformat 很难可靠定位。

## 绝对不要先做

- PDF reader。
- 用户个人文献库。
- Zotero import/export。
- 团队协作。
- Chrome extension 多站点支持。
- 全量 CSL style marketplace。
- AI 自动盲插 citation。
- 复杂账号、订阅、权限后台。
