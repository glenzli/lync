# Lync

去中心化的 LLM Prompt 编译器 — 模块化导入、交叉编译、AI 原生的 Agent 编排。

在大语言模型时代，Markdown 已经演变为**源代码** — System Prompt、技能包、指令集全部用 Markdown 编写。Lync 将它们视为一等编译目标：解析 `@import` 依赖、跨语种交叉编译，并编排 AI 编辑器处理那些属于智能而非工具的语义任务。

👉 [阅读完整的设计规范](DESIGN.md)

### 📦 核心特性

* **去中心化包管理**: 直接通过 URL 拉取 Markdown 模块 — 无注册表，无中间人。
* **确定性构建**: SHA-256 锁文件 (`lync-lock.yaml`) 确保构建可复现。
* **交叉编译**: AST 级语言块过滤 (`<!-- lang:xx -->`) 生成各语种产物；未覆盖语种可自动唤起 LLM 交叉编译回译。
* **双模式引入**:
  * `@import:link` — 别名重写为本地相对路径（保留超链接结构）。
  * `@import:inline` — 内联展开远程内容（组装大型 Prompt 上下文）。

### 🛠️ CLI 命令架构 (v3.0)

| 命令 | 分类 | 说明 |
|------|------|------|
| `lync build` | 确定性工具 | 纯编译器 — AST 组装 + 交叉编译 |
| `lync agent` | Agent 工具 | 零 LLM 编译 + 生成 AI 编辑器编排指令 |
| `lync lint` | LLM 增强工具 | 对编译产物进行语义冲突检测 |
| `lync diff` | LLM 增强工具 | 版本间语义差异分析 |
| `lync graph` | 确定性工具 | ASCII 依赖图谱可视化 |
| `lync seal` | 确定性工具 | 为普通 Markdown 注入 Frontmatter |
| `lync sync` | 确定性工具 | 安装并锁定所有依赖 |

### 🚀 快速上手

```bash
npm install -g lync-md
lync init                    # 生成 lync-build.yaml
lync add https://example.com/skill.md --alias my-skill
lync build                   # 编译工作区
```

完整 CLI 用法请参阅 **[帮助与用法文档](HELP.md)**。
