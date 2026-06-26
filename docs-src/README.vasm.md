---
vasm:
  compile:
    format: "doc"
    targetLangs: ["zh-CN"]
---

# VASMC

去中心化的 LLM Prompt 编译器 — 模块化导入、交叉编译、AI 原生的编译编排，以及输入面主权保障。

在大语言模型时代，Markdown 已经演变为**源代码** — System Prompt、技能包、指令集全部用 Markdown 编写。VASMC 将它们视为一等编译目标：解析 `@import` 依赖、跨语种交叉编译，并编排 AI 编辑器处理那些属于智能而非工具的语义任务。

AI-Native 系统中，整个上下文窗口既是执行空间也是数据空间——LLM 无法区分指令与数据。VASMC 在执行面形成之前建立确定性的控制点：所有进入 system prompt 的内容，都经过编译链的显式声明与组装，来源可追溯，格式有分类。

👉 [阅读完整的设计规范](DESIGN.vasm.md)

### 📦 核心特性

*   **输入面主权**: 编译期内容来源管控——所有进入执行面的 token 都有可追溯的人类授权来源，`prompt` / `doc` 格式分类是编译时的安全分类原语。
*   **去中心化包管理**: 直接通过 URL 拉取 Markdown 模块 — 无注册表，无中间人。
*   **确定性构建**: SHA-256 锁文件 (`vasmc-lock.yaml`) 确保构建可复现。
*   **交叉编译**: AST 级语言块过滤 (`<!-- lang:xx -->`) 生成各语种产物；未覆盖语种由 `vasmc build` 工作单交给当前 AI 处理。
*   **双模式引入**:
    *   `@import:link` — 别名重写为本地相对路径（保留超链接结构）。
    *   `@import:inline` — 内联展开远程内容（组装大型 Prompt 上下文）。

### 🛠️ 包与命令边界

| 包 | 命令 | 说明 |
|------|------|------|
| `@vasm/core` | 无 bin | 共享确定性编译核心与 VASM 协议实现 |
| `@vasm/cli` | `vasmc` | AI build、依赖管理、后续工作单 |
| `@vasm/console` | `vasm-console` | 人用控制台，包含可选外部模型 `lint/diff` |

### 📌 版本与发布

VASMC 使用 Changesets 管理 npm workspace 版本。`@vasm/core`、`@vasm/cli`、`@vasm/console` 当前作为 fixed version group 发布：三者始终保持同一版本号。原因是 `vasmc` 与 `vasm-console` 的发布产物都会内置 core，core 行为变化通常也意味着两个命令产物的语义变化。

发布前先用 `npm run changeset` 声明变更影响和 SemVer 级别，再用 `npm run release:version` 写入版本号与 changelog。正式发布前执行 `npm run release:check`，确认测试、构建、自举编译和 npm pack dry-run 均通过。npm 发布使用 `npm run release:publish`。发布成功后执行 `npm run release:github`：它会检查 package tags、创建 `vX.Y.Z` 聚合 tag、push 当前分支与 tags，并通过 GitHub CLI 创建 GitHub Release。

### 🚀 快速上手

```bash
npm install -g @vasm/cli
vasmc init                    # 生成 vasmc-build.yaml
vasmc add https://example.com/skill.md --alias my-skill
vasmc build                   # 编译工作区，并为当前 AI 生成语义工作单
```

完整 CLI 用法请参阅 **[帮助与用法文档](HELP.vasm.md)**。
