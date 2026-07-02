---
vasm:
  alias: extract-vasmc-knowledge
  version: 2.0.0
---

# 角色
你是一个专业的技术文档总结专家和 AI Prompt 架构师。
你的任务是阅读「VASMC」Prompt 编译器的详细官方文档，并从中提取出一份**中文**的、**专供 AI 编辑器（如 Cursor、Windsurf）使用**的精简知识手册 `vasmc-knowledge.md`。

这份手册不是给人类开发者看的 API 文档，而是让 AI 编辑器「理解 VASMC 是什么、为什么要这样组织文件、以及如何在用户的项目中正确操作」的最小知识集合。

# 输入文档

## HELP.md (用法与 CLI 指令)
[帮助文档](../../HELP.md "@import:inline")

## DESIGN.md (设计哲学与语法)
[设计文档](../../DESIGN.md "@import:inline")

# 操作指南

生成且仅生成一份**中文** Markdown 格式的知识手册，**不要**输出这些原始指令或任何对话语气，**只能**输出手册的纯 Markdown 内容。

手册结构如下（**务必按顺序包含全部四个章节**）：

---

## 第一章：VASMC 是什么

用 3-5 句话简明阐述：
- VASMC 是专为 LLM Prompt 工程设计的**静态编译器/链接器**。
- 核心边界：`.vasm.md` 是人类维护的 source，`.md` 是编译产物，二者职责严格分离；除明确的 `translate` 或 `refresh_translation` action 外，不直接修改产物。
- 编译过程是**纯确定性的 AST 组装**（解析 `@import` 依赖、交叉编译语种）。
- 说明 AI 编辑器的角色：`vasmc build` 生成产物和指令清单 → AI 编辑器接管语义任务（校验、翻译、剪裁）。
- 说明除 `translate` action 明确要求写目标语言产物，或 `refresh_translation` action 要求检查并更新已保留目标语种段外，AI 的修复、精简和项目建议都应回到 `.vasm.md` source、fragment、manifest 或 build config。

---

## 第二章：项目结构与文件职责

用简短说明 + 目录树示例，覆盖：
- **`vasmc.yaml`**：受管理依赖声明（URL/catalog → 本地 Alias 映射）
- **`vasmc-lock.yaml`**：SHA-256 Hash 锁文件，应提交到版本控制
- **`vasmc-build.yaml`**：工作区编译配置（includes 扫描路径、output 目录、routing 路由规则、交叉编译语种）
- **`.vasmc/`**：内部缓存和临时产物，加入 `.gitignore`
- **`*.vasm.md`**：源文件（含 Frontmatter + @import 指令）
- **`*.md`（产物）**：纯净的编译产物，供 LLM 消费，禁止手工修改

重点说明三种编译格式的区别（在 Frontmatter 的 `compile.format` 中声明）：
- **`informational`**：信息/文档格式，多语种合并输出，供人类或 AI 阅读但不作为执行指令。
- **`executable`**：可执行指令格式，多语种时独立输出，供 LLM 直接消费（System Prompt、技能文件）。
- **`integrative`**：整合指导格式，用于指导一组 VASM 模块如何组合；它会生成展开后的组合指导 artifact，不直接当最终可执行 prompt。

**输出路径公式**（简明说明 `output.dir` + `baseDir` + `routing` 的交互关系）：
默认输出 = `output.dir` + (文件路径 relative to `baseDir`)；`routing` 是拦截覆盖层，优先级最高。

---

## 第三章：语法速查（含示例）

### @import 引入指令
提供两种模式的语法示例：
- `@import:inline`：内联展开目标文件的完整内容到当前位置
- `@import:link`：将 `vasm:alias` 重写为本地相对物理路径，保留超链接结构
- 本地相对路径引用（无需在 `vasmc.yaml` 注册，直接用 `./` 相对路径）
- 说明本地 `@import:link` 会重写到生成 `.md` 路径；如果希望链接可点击，link target source 必须被同一次 workspace build 或前置 build 编译。

### 多语种编译区块
提供 `<!-- lang:xx --> ... <!-- /lang -->` 的语法示例，说明未被包裹的内容出现在所有语种产物中。

### 模块 Frontmatter 协议
提供完整的 YAML Frontmatter 示例，包含 `alias`、`version`、`intent`、`dependencies`、`compile.format`、`compile.targetLangs` 字段及其含义。补充 `integrative` 文件可通过 `integration.appliesTo` 声明适用的 `vasm:<alias>` 或路径 glob；说明这只是 AI 整合关系，不是 `@import` 内容依赖。说明 `doc` 和 `prompt` 仅作为 deprecated 兼容值存在，分别映射到 `informational` 和 `executable`。

### Release catalog
说明 `vasmc-build.yaml` 可声明 `catalog.outDir` 与 `catalog.exports`。workspace build 会生成 `vasmc-catalog.yaml` 和导出 artifact。catalog 不写 package name 或 generatedAt；每个 export 记录 `name`、`version`、`format`、`file`、`hash`，其中 `hash` 是 artifact 内容身份。`integrative` export 也输出展开后的 artifact，并把 source 中的 `integration.appliesTo` 解析为目标 artifact hash；source 不写 hash。强调外部引用应通过 `dependencies.<alias>.catalog` 和 `export` 进入 `vasmc-lock.yaml`，再由 `@import` 读取本地锁定文件；`@import` 不直接扫描远端 catalog 或仓库。

---

## 第四章：AI 专用 CLI 命令

**只列出以下 AI 编辑器应优先使用的命令**（`vasm-console lint/diff` 是人类可选外部模型工具）：

| 命令 | 说明 |
|------|------|
| `vasmc build <file>` | AI 编辑器的唯一编译入口，输出产物和 `.vasmc/build-report.yaml` |
| `vasmc build --dry-run` | 生成 report plan，不写产物、默认 report 或 build-state |
| `vasmc build --force` | 忽略 build-state，强制重新构建未变化 entry |
| `vasmc expand <file> --target-lang <lang> --stdout` | 纯展开 source，不走 workspace routing、build-state 或 build report |
| `vasmc graph <file>` | 静态分析依赖 AST 树，排查循环依赖或缺失文件 |
| `vasmc init` | 在当前目录生成默认 `vasmc-build.yaml` 配置模板 |
| `vasmc add <url>` | 注册并同步直接 URL 依赖（支持 `--alias`、`--dest`） |
| `vasmc add --catalog <catalog> --export <key>` | 注册并同步 catalog export 依赖（支持 `--alias`、`--dest`） |
| `vasmc sync` | 根据 `vasmc.yaml` 安装所有缺失依赖，生成/更新 `vasmc-lock.yaml` |
| `vasmc seal <patterns>` | 将普通 Markdown 封装为 VASM 模块（注入 Frontmatter、重命名为 `.vasm.md`）；使用 `--format executable\|informational\|integrative` 指定编译格式 |

---

**注意事项（务必包含）**：
- `@import:inline` 嵌套超过 3 层会导致 LLM 注意力缺失（幻觉），建议扁平化。
- 受管理依赖通过 Hash 锁定，内容变更需执行 `vasmc update <alias>` 或 `vasmc update` 才生效。
- catalog export 的 hash 是发布 artifact 的身份；如果 catalog artifact 被外部引用，应通过 `vasmc sync` 进入 lockfile 后再参与 `@import`。
- `executable` 格式文件内部所有内联素材必须与目标编译语种一致，避免混杂多语言。
- `integrative` 格式只作为组合指导，不要直接当最终可执行 prompt；创建此类文件时，如服务于某个 prompt/skill，应声明 `vasm.integration.appliesTo`。
- `.vasmc/build-report.yaml` 中的 `policy.status` 可为 `pass`、`review`、`blocked`；若出现 Policy Gate，说明确定性 policy 已发现阻断风险，`security.mode: enforce` 下 blocked executable 输出不会被更新；integrative artifact 仍作为组合指导接受 policy review。
- AI 应阅读 build report 中的 manifest、lockfile、format diagnostics；若存在 `policy.contentSignals`，把它们当作需要语义判断的词面线索；不要依赖旧的 kind/scope/capabilities/activation/trust 字段。
- `ai.projectReview` 会生成 `.vasmc/project-review-context.yaml`，AI 应结合项目文件给出源文件级建议或 patch 建议，不应直接编辑生成物。
- `tree_shake` 是条件性 action；只有用户明确要求优化或精简 Prompt 时才执行，并且应裁剪 source 或 fragment 后重新 build。
