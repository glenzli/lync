# VASMC - Help & Usage

[🌍 English](#en) | [🇨🇳 中文](#zh-cn)

---

<a name="en"></a>

## 🌍 English

## Core Syntax And Import Protocol

VASMC sources are Markdown files with optional VASM frontmatter and import directives. Generated Markdown is clean output and should normally not be edited by hand.

### Import Syntax

```markdown
[Link Text](vasm:alias "@import:inline")
[Link Text](./local-file.vasm.md "@import:link")
```

`@import:inline` expands the compiled target content at the link position. Use it for shared rules, reusable prompt fragments, workflow sections, and skill knowledge blocks.

`@import:link` preserves the Markdown link but rewrites `.vasm.md` source references to generated `.md` paths. Use it when the target should stay as a separate document.

Local imports use relative file paths. Managed dependency aliases use `vasm:alias` and are resolved through `vasmc.yaml` plus `vasmc-lock.yaml`.

### Frontmatter

```yaml
---
vasm:
  alias: "my-reviewer"
  version: "1.0.0"
  intent: "Assemble a concise code-review prompt focused on security findings."
  dependencies:
    company-rules: "https://example.com/rules.md"
  compile:
    format: executable
    targetLangs: ["en"]
---
```

`compile.format` accepts three current values:

- `informational`: documentation or knowledge, not an instruction file. Multiple target languages are merged into one file.
- `executable`: prompts, skills, or instructions read by the model. Multiple languages produce separate files.
- `integrative`: source-only guidance for composing multiple VASM modules. It is indexed into the build report and does not produce compiled output.

Deprecated compatibility values are narrow: `doc` maps to `informational`, and `prompt` maps to `executable`. Other values are invalid.

## `@vasm/cli`: AI-Facing Compiler

Install:

```bash
npm install -g @vasm/cli
```

Initialize a workspace:

```bash
vasmc init
```

Register a dependency:

```bash
vasmc add https://example.com/coder-skill.md --alias coder-skill --dest ./skills/coder.md
```

Or declare dependencies in `vasmc.yaml`, including catalog exports:

```yaml
dependencies:
  company-rules: "https://example.com/guidelines.md"
  coder-skill:
    url: "https://example.com/coder-skill.md"
    dest: "./skills/coder.md"
  release-reviewer:
    catalog: "https://example.com/dist/vasm-catalog/vasmc-catalog.yaml"
    export: releaseReviewer
```

Sync dependencies and lock deterministic inputs:

```bash
vasmc sync
vasmc update <alias>
vasmc update
```

Catalog dependencies read `vasmc-catalog.yaml`, then lock the selected artifact by its `file` and `hash`. `@import` still uses `vasm:<alias>` and does not scan remote catalogs or repositories.

Compile a single source:

```bash
vasmc build main.vasm.md -o ./dist
```

Compile the workspace:

```bash
vasmc build
```

`vasmc build` is the AI-side compile entrypoint. It performs deterministic import resolution, AST assembly, language filtering, output writing, and build-report generation. It does not call an external model.

Common build controls:

```bash
vasmc build --dry-run
vasmc build main.vasm.md --dry-run --force
vasmc build --dry-run --report-out .vasmc/plan.yaml
vasmc build --force
```

`--dry-run` emits a YAML report plan to stdout and does not write compiled outputs, the default `.vasmc/build-report.yaml`, project-review context, history cache, or build-state. `--report-out` explicitly writes the report plan to a chosen file. `--force` ignores build-state and rebuilds unchanged entries.

After every build, the current AI editor should read:

```bash
cat .vasmc/build-report.yaml
```

The report records compiled entries, output files, manifest summaries, policy status, diagnostics, content signals, integrative guides, and semantic actions such as `verify`, `integration_guidance`, `translate`, `refresh_translation`, `diff`, `tree_shake`, `policy_review`, `policy_gate`, and `project_review`.

Other deterministic commands:

```bash
vasmc expand main.vasm.md --target-lang zh-CN --stdout
vasmc graph main.vasm.md
vasmc seal my-prompt.md --alias my-custom-name
vasmc seal "prompts/**/*.md" --format executable
```

`expand` performs deterministic import expansion and language-block filtering without workspace routing, build-state, or build reports. It writes stdout by default and only writes a file when `--output` is explicit.

`seal` injects VASM frontmatter into ordinary Markdown and renames files to `.vasm.md`. Use `--format informational` for README, HELP, DESIGN, and guides; `--format executable` for prompts and skills; `--format integrative` for composition guidance.

### Workspace Build Configuration

```yaml
includes:
  - "src/**/*.vasm.md"

output:
  dir: "./dist"

baseDir: "./src"

compile:
  informational:
    targetLangs: ["en", "zh-CN"]
  executable:
    targetLangs: ["en"]

routing:
  - match: "src/skills/*.vasm.md"
    dest: "./dist/skills/"

catalog:
  outDir: "./dist/vasm-catalog"
  exports:
    mainSkill:
      source: "src/skills/main-skill.vasm.md"
      targetLang: "en"
    mainWorkflow:
      source: "src/integrations/main-workflow.vasm.md"
```

CLI overrides are also available:

```bash
vasmc build --out-dir ./doc --base-dir ./src
```

`--out-dir` is not dry-run. When a source matches `routing`, `routing.dest` still controls the final output path.

When `catalog.exports` is configured, workspace builds also emit `catalog.outDir/vasmc-catalog.yaml` and exported artifacts. The catalog is a release index: `executable`/`informational` exports are compiled Markdown, `integrative` exports are expanded guidance artifacts, and external consumers should lock artifacts through `dependencies.<alias>.catalog` / `export` before importing them.

## AI Build Workflow

For AI editors, the workflow is:

1. Run `vasmc build [file]` or `vasmc build`.
2. Read `.vasmc/build-report.yaml` immediately.
3. Treat generated `.md` files as review evidence.
4. Execute report actions in order.
5. If edits are required, modify `.vasm.md` source, fragments, manifests, or `vasmc-build.yaml`.
6. Rebuild and report the final outputs and residual risk.

If `ai.projectReview` is enabled, VASMC also writes `.vasmc/project-review-context.yaml` and adds a top-level `project_review` action. The compiler still does not call a model; it only gives the current AI editor a structured review task.

## Policy Status

Every build report entry includes `policy.status`:

- `pass`: no deterministic risk signal.
- `review`: output is allowed, but AI or human review should inspect diagnostics.
- `blocked`: a deterministic blocking risk exists, such as invalid manifest shape, format-boundary violation, or lockfile hash mismatch.

`security.mode: review` reports risk without blocking. `security.mode: enforce` prevents blocked `executable` outputs from being updated. Integrative entries are source-only and only report policy.

`policy.contentSignals` do not change `policy.status` and never trigger enforce blocking. AI should decide whether signal evidence is an active instruction, a prohibition, an example, or documentation.

## `@vasm/console`: Human-Facing Optional Model Tools

Install:

```bash
npm install -g @vasm/console
```

Semantic lint after compiling:

```bash
vasmc build main.vasm.md
vasm-console lint main.md --model gpt-4o
```

Semantic diff between compiled outputs:

```bash
vasm-console diff new.md old.md --model gpt-4o
```

`vasm-console` can read OpenAI-compatible settings from environment variables or `.vasmrc`:

```yaml
lang: "en"
llm:
  baseURL: "https://api.openai.com/v1"
  apiKey: "your-api-key"
  model: "gpt-4o"
```

Environment equivalents:

```bash
VASM_LLM_API_KEY=...
VASM_LLM_BASE_URL=...
VASM_LLM_MODEL=...
```

The deterministic compiler does not require these model settings. They are only used by optional `@vasm/console` commands.

---

<a name="zh-cn"></a>

## 🇨🇳 中文

<a name="syntax-zh-cn"></a>

## 🔮 核心语法与引入协议 (Core Syntax)

### 引入语法

`[链接文本](vasm:alias "@vasm-directive")`

- **链接重写模式 (`@import:link`)**:
  编译器将 `vasm:alias` 替换为目标文件的本地相对物理路径，保留超链接结构。
  ```markdown
  请参阅下方的 [代码审查辅助技能](vasm:coder-skill "@import:link")。
  ```
  *构建输出*: `请参阅下方的 [代码审查辅助技能](./skills/coder.md)。`

- **内联展开模式 (`@import:inline`)**:
  编译器读取目标文件的纯文本内容，并直接替换该引用链接。主要用于组装大型 Prompt 上下文。
  ```markdown
  根据本组织的 [公司开发规范](vasm:company-rules "@import:inline")：
  ```
  *构建输出*: 原始链接被移除，并在原位置插入 `guidelines.md` 的完整文本内容。

### 多语种输出 (Cross-Compilation)

VASMC 支持用语言块为 Prompt 声明不同语种内容：

```markdown
# 通用系统规则
你是一个代码专家。

<!-- lang:en -->
Please explain the code step by step.
<!-- /lang -->

<!-- lang:zh-CN -->
请逐步解释代码。
<!-- /lang -->
```

生成时，使用 `--target-langs` 参数指定你需要生成的语言。VASMC 会自动过滤 AST 树，分别输出纯净的各语言产物。

---

<a name="publish-zh-cn"></a>

## 📦 发布模块 (Frontmatter 注入)

如果您通过公共 URL 分发提示词模块，强烈建议在 `.md` 文件顶部添加 YAML Frontmatter 块，声明正式别名和嵌套依赖项。

手动注入内容的示例：

```yaml
---
vasm:
  alias: "my-coder-prompt"
  version: "1.0.0"
  intent: "Assemble a concise code-review prompt focused on security findings."
  dependencies:
    anti-delusion: "https://example.com/system.md"
  compile:
    format: executable    # informational | executable | integrative
    targetLangs: ["zh-CN"]
---

# 你的 Prompt 正文内容...
```

*当其他人通过 `vasmc add <your-url>` 安装时，VASMC 会解析这些内容并还原依赖配置。*

> **`intent`**：声明源文件希望产物达成的用途。`vasmc build` 不调用模型执行它，只把它写入 AI report actions，供当前 AI 做 Verify 或 Integration Review。
>
> **`compile.format`**：
>
> - `informational`：纯信息/文档产物，多个目标语种会合并为一个 Markdown 文件。
> - `executable`：作为 AI 指令读取的 prompt/skill 产物，多语种时每种语言输出独立文件。
> - `integrative`：用于指导一组 VASM 模块如何组合；它是 source-only，不生成自己的 compiled output，AI 应在组合时参考它。
>
> 为了平滑迁移，`doc` 会映射为 `informational`，`prompt` 会映射为 `executable`，并输出 deprecated 诊断；其他值是非法格式。

> **`integration.appliesTo`**：只用于 `integrative` 文件，声明这份整合指导适用于哪些 prompt/skill。支持 `vasm:<alias>`，也支持 source/output 路径 glob。它不会把 guide 内容编进目标产物，也不会为 guide 生成 output；只会在命中的 executable entry 上生成 `integration_guidance` action。

```yaml
vasm:
  alias: reviewer-integration-guide
  compile:
    format: integrative
  integration:
    appliesTo:
      - vasm:security-reviewer
      - skill-src/reviewer/**/*.vasm.md
```

### 确定性 Policy Gate

AI 侧 `vasmc build` 会为每个 entry 生成 `policy.status`：

- `pass`：未发现确定性 policy 风险。
- `review`：存在需要 AI 或人类阅读的风险信号，例如疑似 prompt override、隐藏行为、密钥外传、integrative/executable 边界不清。
- `blocked`：存在确定性阻断风险，例如 manifest 结构错误、受管理依赖 hash 与 `vasmc-lock.yaml` 不一致、`informational` 产物导入了 `executable` 或 `integrative` 内容。

默认情况下，VASMC 只报告风险，不阻断输出：

```yaml
security:
  mode: review
```

如果项目希望启用本地确定性阻断，可以在 `vasmc-build.yaml` 中切换为：

```yaml
security:
  mode: enforce
```

`enforce` 会阻止 `executable` 产物在 blocked 状态下被更新；`informational` 文档仍按确定性编译流程输出并记录报告。integrative 是 source-only，只报告 policy。被阻断时，`.vasmc/build-report.yaml` 会记录 `status: blocked`，并在对应 entry 的 `actions` 中写入 `policy_gate`。

### Project Review Pass

VASMC 可以在编译完成后生成一个项目上下文索引，让当前 AI 结合仓库内容审查编译产物是否贴合项目，而不是只做语法编译：

```yaml
ai:
  projectReview:
    mode: suggest      # off | suggest | patch
    include:
      - "README.md"
      - "docs/**/*.md"
      - "package.json"
      - "vasmc-build.yaml"
      - "skill-src/**/*.vasm.md"
```

开启后，`vasmc build` 会生成 `.vasmc/project-review-context.yaml`，并在 `.vasmc/build-report.yaml` 顶层 `actions` 中写入 `project_review`。该 pass 不调用模型，也不自动改文件；它只告诉当前 AI 应读取哪些项目文件，并要求 AI 输出源文件级建议。`patch` 模式表示可以给出聚焦的源文件 patch 建议，但仍不得直接编辑生成物。

<a name="cli-zh-cn"></a>

## 🛠️ @vasm/cli：AI 编译与报告

`@vasm/cli` 提供 `vasmc` 命令，是 VASMC 的 AI-facing 编译入口。它只做确定性工作：依赖同步、AST 组装、语言块过滤、产物写入，以及生成给当前 AI 使用的结构化 report actions。

### 安装

```bash
npm install -g @vasm/cli
```

### 1. 初始化项目

```bash
vasmc init
```

在工程根目录建立一个 `vasmc.yaml` 来声明依赖：

```yaml
dependencies:
  company-rules: "https://example.com/guidelines.md"
  coder-skill:
    url: "https://example.com/coder-skill.md"
    dest: "./skills/coder.md"
  release-reviewer:
    catalog: "https://example.com/dist/vasm-catalog/vasmc-catalog.yaml"
    export: releaseReviewer
```

也可以直接使用命令行注册依赖：

```bash
vasmc add https://example.com/coder-skill.md --alias coder-skill --dest ./skills/coder.md
```

### 2. 同步与锁定

将 `.vasmc/` 加入 `.gitignore`。这是 VASMC 的内部缓存目录。`vasmc-lock.yaml` 应提交到版本控制，它确保构建输入确定。

```gitignore
.vasmc/
```

安装所有缺失依赖并生成或更新锁文件：

```bash
vasmc sync
```

catalog 依赖会先读取 `vasmc-catalog.yaml`，再按其中的 `file` 和 `hash` 固定具体 artifact。最终 `@import` 仍然使用 `vasm:<alias>`，不直接扫描远端 catalog 或仓库。

需要强制刷新时：

```bash
vasmc update <alias>
vasmc update
```

### 3. AI 编译

一对一编译并生成结构化报告：

```bash
vasmc build main.vasm.md -o ./dist
```

工作区编译并生成结构化报告：

```bash
vasmc build
```

`vasmc build` 是 AI 侧唯一编译入口。它会执行确定性的 AST 组装、语言块过滤和产物写入；如果目标语言缺失，它不会调用外部模型自动补全，而是在 `.vasmc/build-report.yaml` 的 `actions` 中记录后续工作，让当前 AI 通过 VASM skill 接管 Verify、Integration Guidance、Translate、Refresh Translation、Diff、Policy Review、Policy Gate、Project Review 和 Tree-Shake 等语义任务。对于 `informational` 输出，如果既有合并文档中已有旧目标语种段，VASMC 会保留它们并要求 AI 检查是否需要刷新。

常用控制参数：

```bash
vasmc build --dry-run
vasmc build main.vasm.md --dry-run --force
vasmc build --dry-run --report-out .vasmc/plan.yaml
vasmc build --force
```

`--dry-run` 会把 YAML report plan 输出到 stdout，不写编译产物、默认 `.vasmc/build-report.yaml`、project-review context、history cache 或 build-state。`--report-out` 表示显式把这份 plan 写入指定文件。`--force` 会忽略 build-state，强制重新生成未变化的 entry。

如果只需要一份展开稿，不想走 workspace routing 或 report actions：

```bash
vasmc expand main.vasm.md --target-lang zh-CN --stdout
```

`expand` 只做确定性的 import 展开和语言块筛选。除非显式传 `--output`，否则它不会写产物、build-state 或 build report。

### 4. 构建报告

```bash
cat .vasmc/build-report.yaml
```

每次执行 `vasmc build` 后，AI 编辑器都应立即读取 `.vasmc/build-report.yaml`，并由 VASM skill 按 report 中的 `actions` 顺序执行。report 会记录本次构建涉及的入口、产物、`compiledFiles`、`minimalTokenVariant`、manifest 摘要、依赖、integrative guides、`policy.status`、policy diagnostics 和 content signals，供 AI 做上下文与边界审查。若启用 `ai.projectReview`，`.vasmc/project-review-context.yaml` 会列出可供 AI 做项目感知建议的文件索引。

### 5. 其他确定性命令

```bash
vasmc graph main.vasm.md
vasmc seal my-prompt.md --alias my-custom-name
vasmc seal "prompts/**/*.md" --format executable
```

`seal` 会为普通 Markdown 注入 VASM Frontmatter，并将文件重命名为 `.vasm.md`。对于 README、HELP、DESIGN 等信息文档，请显式使用 `--format informational`；对于 System Prompt、Skill 等 AI 消费文件，请使用 `--format executable`；对于 source-only 整合指导文件，请使用 `--format integrative`，并在 source 中补充 `vasm.integration.appliesTo`。

---

<a name="workspace-zh-cn"></a>

### 🗂️ 工作区批量编译

```yaml
includes:
  - "src/**/*.vasm.md"

output:
  dir: "./dist"

baseDir: "./src"

compile:
  informational:
    targetLangs: ["zh-CN"]
  executable:
    targetLangs: ["zh-CN"]

routing:
  - match: "src/agents/*.vasm.md"
    dest: "./dist/agents/"

catalog:
  outDir: "./dist/vasm-catalog"
  exports:
    mainSkill:
      source: "src/agents/main-skill.vasm.md"
      targetLang: "zh-CN"
    mainWorkflow:
      source: "src/integrations/main-workflow.vasm.md"
```

也支持 CLI 临时覆盖：

```bash
vasmc build --out-dir ./doc --base-dir ./src
```

注意：`--out-dir` 不是 dry-run。只要 source 命中 `routing`，最终写入路径仍由 `routing.dest` 决定。

如果配置了 `catalog.exports`，workspace build 会额外生成 `catalog.outDir/vasmc-catalog.yaml` 和导出 artifact。catalog 是 release 索引：`executable`/`informational` 导出编译后 Markdown，`integrative` 导出展开后的组合指导，并把适用关系写入 catalog。外部使用时应通过 `dependencies.<alias>.catalog` / `export` 锁定 artifact hash，再由 `@import` 走本地锁定文件。

<a name="cli-ai-build-zh-cn"></a>

## 🤖 AI Build 工作流

使用 AI 编辑器处理 VASM 项目时，VASMC 只负责确定性组装；语义校验、翻译、Diff 和裁剪由当前 AI 完成。当前 AI 助手应使用 AI 侧 build 执行编译：

```bash
vasmc build [file]
```

> **AI 编辑器始终使用 `vasmc build`。**
> 在 `@vasm/cli` 中，`build` 会同时产出确定性 Markdown 和 `.vasmc/build-report.yaml` 结构化 actions。

在该模式下，VASMC 执行 AST 静态组装，并在项目隐藏目录输出结构化报告：

**`.vasmc/build-report.yaml`**

**`.vasmc/project-review-context.yaml`**（仅在 `ai.projectReview` 开启时生成）

### AI 助手操作规程

每当你执行了 `vasmc build` 命令后，**立即读取 `.vasmc/build-report.yaml`**，并按 `entries[].actions` 与顶层 `actions` 顺序执行以下任务（具体步骤由编译器按需记录）：

1. **Semantic Verify**：当 action 为 `verify` 时，读取 `minimalTokenVariant.path`，检查语义冲突、人格分裂、逻辑冗余和系统破坏风险四类问题。
2. **Integration Review**：当 action 为 `integration_review` 时，读取 integrative source，把它当作组合指导，而不是最终可执行 prompt，检查组合边界是否清楚。
3. **Integration Guidance**：当 action 为 `integration_guidance` 时，读取 `guides[].source` 中匹配的 integrative guide，再组合该 executable 与其他 VASM 产物；不要把 guide 直接 inline 进最终 prompt。
4. **Translation**：当 action 为 `translate` 时，将 `target` 文件翻译到 `targets` 指定的其他语种，**严格保留** Markdown AST 结构。
5. **Refresh Translation**：当 action 为 `refresh_translation` 时，检查 informational 输出中被保留的旧目标语种段是否仍匹配新 source，只更新过期译文。
6. **Semantic Diff**：当 action 为 `diff` 时，读取 `history` 中的历史备份文件，向用户说明本次编译在底层结构上影响了什么。
7. **Policy Review**：当 action 为 `policy_review` 时，检查 manifest、lockfile、format 边界 diagnostics，以及 `policy.contentSignals` 中需要语义判断的词面线索。
8. **Policy Gate**：当 action 为 `policy_gate` 时，说明确定性 policy 已发现阻断风险；在 `security.mode: enforce` 下，VASMC 不会更新 blocked 的 `executable` 输出。integrative 是 source-only，只报告 policy。
9. **Project Review**：当顶层 action 为 `project_review` 时，读取 `.vasmc/project-review-context.yaml` 和 `.vasmc/build-report.yaml`，结合项目文件给出源文件级建议或 patch 建议，不能直接编辑生成物。
10. **Tree-Shake**：当 action 为 `tree_shake` 且用户明确表达了优化 Prompt 的意图时，才执行裁剪分析。

VASMC 负责确定性组装、路由和报告；当前 AI 负责语义判断、翻译和冲突处理。

### Policy 状态

`.vasmc/build-report.yaml` 中每个 entry 都包含 `policy.status`：

- `pass`：无确定性风险信号。
- `review`：允许输出，但 AI 必须审查 report 中的 diagnostics。
- `blocked`：存在可确定的阻断风险，例如 manifest 结构错误、format 边界错误或 lockfile hash 失配。默认 `review` 模式只报告；`enforce` 模式会阻止 blocked 的 `executable` 输出被更新。integrative 是 source-only，只报告 policy。

`policy.contentSignals` 不改变 `policy.status`，也不会触发 enforce 阻断。AI 应判断 signal evidence 是 active instruction、prohibition、example 还是 documentation。

### Project Review

项目可以在 `vasmc-build.yaml` 中开启项目感知审查：

```yaml
ai:
  projectReview:
    mode: suggest
    include:
      - "README.md"
      - "docs/**/*.md"
      - "package.json"
```

这是 AI pass，不是编译器自动重写。VASMC 只生成上下文索引和 report action；当前 AI 根据索引读取项目文件，检查 prompt/skill 是否缺少项目实际命令、目录、术语、约束，`intent` 或 `compile.format` 是否准确，以及是否存在重复 fragment。

<a name="console-zh-cn"></a>

## 🧭 @vasm/console：人用控制台与可选外部模型工具

`@vasm/console` 提供 `vasm-console` 命令，面向人类开发者使用。它复用确定性编译代码，但额外提供需要外部模型的语义检查命令。

### 安装

```bash
npm install -g @vasm/console
```

### 语义校验

编译完成后，可以用 LLM 检查产物中的语义冲突：

```bash
vasmc build main.vasm.md
vasm-console lint main.md --model gpt-4o
```

`lint` 会检查四类问题：指令冲突、人格分裂、逻辑冗余和系统破坏风险。它不属于确定性编译链，失败时不会改变源文件或产物文件。

### 语义 Diff

```bash
vasm-console diff new.md old.md --model gpt-4o
```

`diff` 会解释两个编译产物之间的语义和结构影响，而不是只报告文本差异。

### 外部模型配置

`vasm-console` 可以通过环境变量或 `.vasmrc` 配置 OpenAI-compatible 节点。`.vasmrc` 可以放在用户目录或项目根目录；项目内 `.vasmrc` 应加入 `.gitignore`。

```yaml
lang: "zh-CN"
llm:
  baseURL: "https://api.deepseek.com/v1"
  apiKey: "your-custom-api-key"
  model: "deepseek-chat"
```

等价环境变量：

```bash
VASM_LLM_API_KEY=...
VASM_LLM_BASE_URL=...
VASM_LLM_MODEL=...
```

`lang` 也会影响 VASMC 的交互日志语言；`llm` 只被 `@vasm/console` 的外部模型工具读取。
