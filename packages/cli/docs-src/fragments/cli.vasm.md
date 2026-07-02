<a name="cli"></a>
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

`seal` 会为普通 Markdown 注入 VASM Frontmatter，并将文件重命名为 `.vasm.md`。对于 README、HELP、DESIGN 等信息文档，请显式使用 `--format informational`；对于 System Prompt、Skill 等 AI 消费文件，请使用 `--format executable`；对于整合指导文件，请使用 `--format integrative`，并在 source 中补充 `vasm.integration.appliesTo`。

---

<a name="workspace"></a>
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
vasmc build --security enforce
```

注意：`--out-dir` 不是 dry-run。只要 source 命中 `routing`，最终写入路径仍由 `routing.dest` 决定。

如果配置了 `catalog.exports`，workspace build 会额外生成 `catalog.outDir/vasmc-catalog.yaml` 和导出 artifact。catalog 是 release 索引：`executable`/`informational` 导出编译后 Markdown，`integrative` 导出展开后的组合指导，并把 source 中的适用关系解析为目标 artifact hash。外部使用时应通过 `dependencies.<alias>.catalog` / `export` 锁定 artifact hash，再由 `@import` 走本地锁定文件。
