# VASMC

[🇨🇳 中文](#zh-cn) | [🌍 English](#en)

***

<a name="zh-cn"></a>

## 🇨🇳 中文

去中心化的 LLM Prompt 编译器 — 模块化导入、交叉编译、AI 原生的 Agent 编排，以及输入面主权保障。

在大语言模型时代，Markdown 已经演变为**源代码** — System Prompt、技能包、指令集全部用 Markdown 编写。VASMC 将它们视为一等编译目标：解析 `@import` 依赖、跨语种交叉编译，并编排 AI 编辑器处理那些属于智能而非工具的语义任务。

AI-Native 系统中，整个上下文窗口既是执行空间也是数据空间——LLM 无法区分指令与数据。VASMC 在执行面形成之前建立确定性的控制点：所有进入 system prompt 的内容，都经过编译链的显式声明与组装，来源可追溯，格式有分类。

👉 [阅读完整的设计规范](DESIGN.md)

### 📦 核心特性

* **输入面主权**: 编译期内容来源管控——所有进入执行面的 token 都有可追溯的人类授权来源，`prompt` / `doc` 格式分类是编译时的安全分类原语。
* **去中心化包管理**: 直接通过 URL 拉取 Markdown 模块 — 无注册表，无中间人。
* **确定性构建**: SHA-256 锁文件 (`vasmc-lock.yaml`) 确保构建可复现。
* **交叉编译**: AST 级语言块过滤 (`<!-- lang:xx -->`) 生成各语种产物；未覆盖语种可自动唤起 LLM 交叉编译回译。
* **双模式引入**:
  * `@import:link` — 别名重写为本地相对路径（保留超链接结构）。
  * `@import:inline` — 内联展开远程内容（组装大型 Prompt 上下文）。

### 🛠️ CLI 命令架构 (v3.0)

| 命令 | 分类 | 说明 |
|------|------|------|
| `vasmc build` | 确定性工具 | 纯编译器 — AST 组装 + 交叉编译 |
| `vasmc agent` | Agent 工具 | 零 LLM 编译 + 生成 AI 编辑器编排指令 |
| `vasmc lint` | LLM 增强工具 | 对编译产物进行语义冲突检测 |
| `vasmc diff` | LLM 增强工具 | 版本间语义差异分析 |
| `vasmc graph` | 确定性工具 | ASCII 依赖图谱可视化 |
| `vasmc seal` | 确定性工具 | 为普通 Markdown 注入 Frontmatter |
| `vasmc sync` | 确定性工具 | 安装并锁定所有依赖 |

### 🚀 快速上手

```bash
npm install -g @vasm/cli
vasmc init                    # 生成 vasmc-build.yaml
vasmc add https://example.com/skill.md --alias my-skill
vasmc build                   # 编译工作区
```

完整 CLI 用法请参阅 **[帮助与用法文档](HELP.md)**。

***

<a name="en"></a>

## 🌍 English

Decentralized LLM Prompt Compiler — Modular imports, cross-compilation, AI-native Agent orchestration, and input-surface sovereignty protection.

In the era of Large Language Models, Markdown has evolved into **source code** — System Prompts, skill sets, and instruction sets are all written in Markdown. VASMC treats them as first-class compilation targets: parsing `@import` dependencies, cross-compiling across languages, and orchestrating AI editors to handle semantic tasks that belong to intelligence rather than tools.

In AI-Native systems, the entire context window is both execution space and data space — LLMs cannot distinguish between instructions and data. VASMC establishes deterministic control points before the execution surface is formed: all content entering the system prompt undergoes explicit declaration and assembly through the compilation chain, with traceable origins and categorized formats.

👉 [Read the full design specification](DESIGN.md)

### 📦 Core Features

* **Input-Surface Sovereignty**: Compilation-time content source control — all tokens entering the execution surface have traceable human-authorized origins; `prompt` / `doc` format classification serves as a security classification primitive at compile time.
* **Decentralized Package Management**: Pull Markdown modules directly via URL — no registry, no middleman.
* **Deterministic Builds**: SHA-256 lock files (`vasmc-lock.yaml`) ensure reproducible builds.
* **Cross-Compilation**: AST-level language block filtering (`<!-- lang:xx -->`) generates artifacts for various languages; uncovered languages can automatically trigger LLM cross-compilation back-translation.
* **Dual-Mode Import**:
  * `@import:link` — Alias rewritten to local relative paths (preserving hyperlink structure).
  * `@import:inline` — Inline expansion of remote content (assembling large Prompt contexts).

### 🛠️ CLI Command Architecture (v3.0)

| Command | Category | Description |
|------|------|------|
| `vasmc build` | Deterministic Tool | Pure compiler — AST assembly + cross-compilation |
| `vasmc agent` | Agent Tool | Zero-LLM compilation + generating AI editor orchestration instructions |
| `vasmc lint` | LLM-Enhanced Tool | Semantic conflict detection for compiled artifacts |
| `vasmc diff` | LLM-Enhanced Tool | Semantic difference analysis between versions |
| `vasmc graph` | Deterministic Tool | ASCII dependency graph visualization |
| `vasmc seal` | Deterministic Tool | Inject Frontmatter into standard Markdown |
| `vasmc sync` | Deterministic Tool | Install and lock all dependencies |

### 🚀 Quick Start

```bash
npm install -g @vasm/cli
vasmc init                    # Generate vasmc-build.yaml
vasmc add https://example.com/skill.md --alias my-skill
vasmc build                   # Compile workspace
```

For full CLI usage, please refer to the **[Help and Usage Documentation](HELP.md)**.
