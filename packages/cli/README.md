# @vasm/cli

[🌍 English](#en) | [🇨🇳 中文](#zh-cn)

---

<a name="en"></a>

## 🌍 English

`@vasm/cli` publishes the `vasmc` command. It is the AI-facing VASMC entrypoint: it compiles `.vasm.md` sources into clean Markdown outputs and, during `build`, emits structured `.vasmc/build-report.yaml` actions so the active VASM skill can continue semantic work.

`vasmc` only performs deterministic work: dependency sync, AST assembly, language-block filtering, output writes, policy diagnostics, content signal collection, and report action generation.

### Install

```bash
npm install -g @vasm/cli
```

### 1. Initialize A Project

```bash
vasmc init
```

Declare dependencies in `vasmc.yaml`:

```yaml
dependencies:
  company-rules: "https://example.com/guidelines.md"
  coder-skill:
    url: "https://example.com/coder-skill.md"
    dest: "./skills/coder.md"
```

Or register one from the command line:

```bash
vasmc add https://example.com/coder-skill.md --alias coder-skill --dest ./skills/coder.md
```

### 2. Sync And Lock

Add `.vasmc/` to `.gitignore`; it is an internal cache directory. Commit `vasmc-lock.yaml` so build inputs stay deterministic.

```gitignore
.vasmc/
```

Install missing dependencies and update the lockfile:

```bash
vasmc sync
```

Force refresh when needed:

```bash
vasmc update <alias>
vasmc update
```

### 3. AI Build

Compile one entry and generate a structured build report:

```bash
vasmc build main.vasm.md -o ./dist
```

Compile the workspace through `vasmc-build.yaml`:

```bash
vasmc build
```

`vasmc build` is the AI-side compiler entrypoint. It writes deterministic Markdown outputs and `.vasmc/build-report.yaml`. If a target language is missing, `vasmc` does not call an external model; instead, it records actions for the current AI to handle Verify, Translate, Refresh Translation, Diff, Policy Review, Policy Gate, Project Review, and Tree-Shake tasks as needed. For `informational` outputs, existing target-language sections can be preserved and marked for refresh review instead of being dropped.

Useful build controls:

```bash
vasmc build --dry-run
vasmc build main.vasm.md --dry-run --force
vasmc build --dry-run --report-out .vasmc/plan.yaml
vasmc build --force
```

`--dry-run` emits a YAML report plan to stdout and does not write compiled outputs, `.vasmc/build-report.yaml`, project-review context, history cache, or build-state. `--report-out` explicitly writes that report plan to a chosen file. `--force` ignores build-state and rebuilds unchanged entries.

For a pure expanded draft without workspace routing or report actions:

```bash
vasmc expand main.vasm.md --target-lang zh-CN --stdout
```

`expand` performs deterministic import expansion and language-block filtering only. It does not update outputs, build-state, or build reports unless `--output` is explicitly provided.

### 4. Read The Build Report

```bash
cat .vasmc/build-report.yaml
```

After every `vasmc build`, an AI editor should immediately read `.vasmc/build-report.yaml`; the VASM skill interprets `entries[].actions` and top-level `actions`. The report records entries, outputs, compiled files, minimal-token variants, manifest summaries, dependencies, `policy.status`, policy diagnostics, and content signals. If `ai.projectReview` is enabled, `.vasmc/project-review-context.yaml` lists files the AI can inspect for project-aware suggestions.

### 5. Other Deterministic Commands

```bash
vasmc graph main.vasm.md
vasmc seal my-prompt.md --alias my-custom-name
vasmc seal "prompts/**/*.md" --format executable
```

`seal` injects VASM frontmatter into ordinary Markdown and renames files to `.vasm.md`. Use `--format informational` for documents such as README, HELP, and DESIGN. Use `--format executable` for system prompts and skills consumed by AI. Use `--format integrative` for composition guidance.

### Workspace Builds

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
  integrative:
    targetLangs: ["en"]

routing:
  - match: "src/agents/*.vasm.md"
    dest: "./dist/agents/"
```

CLI overrides are also supported:

```bash
vasmc build --out-dir ./doc --base-dir ./src
```

---

<a name="zh-cn"></a>

## 🇨🇳 中文

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

`vasmc build` 是 AI 侧唯一编译入口。它会执行确定性的 AST 组装、语言块过滤和产物写入；如果目标语言缺失，它不会调用外部模型自动补全，而是在 `.vasmc/build-report.yaml` 的 `actions` 中记录后续工作，让当前 AI 通过 VASM skill 接管 Verify、Translate、Refresh Translation、Diff、Policy Review、Policy Gate、Project Review 和 Tree-Shake 等语义任务。对于 `informational` 输出，如果既有合并文档中已有旧目标语种段，VASMC 会保留它们并要求 AI 检查是否需要刷新。

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

每次执行 `vasmc build` 后，AI 编辑器都应立即读取 `.vasmc/build-report.yaml`，并由 VASM skill 按 report 中的 `actions` 顺序执行。report 会记录本次构建涉及的入口、产物、`compiledFiles`、`minimalTokenVariant`、manifest 摘要、依赖、`policy.status`、policy diagnostics 和 content signals，供 AI 做上下文与边界审查。若启用 `ai.projectReview`，`.vasmc/project-review-context.yaml` 会列出可供 AI 做项目感知建议的文件索引。

### 5. 其他确定性命令

```bash
vasmc graph main.vasm.md
vasmc seal my-prompt.md --alias my-custom-name
vasmc seal "prompts/**/*.md" --format executable
```

`seal` 会为普通 Markdown 注入 VASM Frontmatter，并将文件重命名为 `.vasm.md`。对于 README、HELP、DESIGN 等信息文档，请显式使用 `--format informational`；对于 System Prompt、Skill 等 AI 消费文件，请使用 `--format executable`；对于整合指导文件，请使用 `--format integrative`。

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
  integrative:
    targetLangs: ["zh-CN"]

routing:
  - match: "src/agents/*.vasm.md"
    dest: "./dist/agents/"
```

也支持 CLI 临时覆盖：

```bash
vasmc build --out-dir ./doc --base-dir ./src
```

注意：`--out-dir` 不是 dry-run。只要 source 命中 `routing`，最终写入路径仍由 `routing.dest` 决定。

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
2. **Integration Review**：当 action 为 `integration_review` 时，把目标文件当作组合指导，而不是最终可执行 prompt，检查组合边界是否清楚。
3. **Translation**：当 action 为 `translate` 时，将 `target` 文件翻译到 `targets` 指定的其他语种，**严格保留** Markdown AST 结构。
4. **Refresh Translation**：当 action 为 `refresh_translation` 时，检查 informational 输出中被保留的旧目标语种段是否仍匹配新 source，只更新过期译文。
5. **Semantic Diff**：当 action 为 `diff` 时，读取 `history` 中的历史备份文件，向用户说明本次编译在底层结构上影响了什么。
6. **Policy Review**：当 action 为 `policy_review` 时，检查 manifest、lockfile、format 边界 diagnostics，以及 `policy.contentSignals` 中需要语义判断的词面线索。
7. **Policy Gate**：当 action 为 `policy_gate` 时，说明确定性 policy 已发现阻断风险；在 `security.mode: enforce` 下，VASMC 不会更新 blocked 的 `executable` 或 `integrative` 输出。
8. **Project Review**：当顶层 action 为 `project_review` 时，读取 `.vasmc/project-review-context.yaml` 和 `.vasmc/build-report.yaml`，结合项目文件给出源文件级建议或 patch 建议，不能直接编辑生成物。
9. **Tree-Shake**：当 action 为 `tree_shake` 且用户明确表达了优化 Prompt 的意图时，才执行裁剪分析。

VASMC 负责确定性组装、路由和报告；当前 AI 负责语义判断、翻译和冲突处理。

### Policy 状态

`.vasmc/build-report.yaml` 中每个 entry 都包含 `policy.status`：

- `pass`：无确定性风险信号。
- `review`：允许输出，但 AI 必须审查 report 中的 diagnostics。
- `blocked`：存在可确定的阻断风险，例如 manifest 结构错误、format 边界错误或 lockfile hash 失配。默认 `review` 模式只报告；`enforce` 模式会阻止 blocked 的 `executable` 和 `integrative` 输出被更新。

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
