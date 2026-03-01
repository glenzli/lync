# Lync Expert Skill Pipeline

🌍 [English](#english) | 🇨🇳 [中文](#chinese)

---

<a name="english"></a>
## 🌍 English

This directory contains the necessary components and pipeline to generate `lync-expert.md`, a highly-condensed **standalone System Prompt** designed for AI code editors (like Cursor, Windsurf, or Copilot).

When you provide `lync-expert.md` to your editor (e.g., placing it in `.cursorrules`), the AI instantly acquires specialized knowledge required to comprehend, write, and debug Lync's AST-based markdown prompts.

### ⚙️ How it works (Self-Hosted Extraction Pipeline)

Instead of manually maintaining a cheat sheet when Lync's overarching syntax changes, this repository uses Lync's own compiler to dynamically document itself.

#### 1. The Extraction Prompt (`extract-cheat-sheet.lync.md`)
This file is an extraction prompt. It utilizes Lync's `@import:inline` to dynamically include the entirety of the project's root `HELP.md` and `DESIGN.en.md`.
It instructs an LLM to read these extensive documents and distill them into an ultra-concise `cheat-sheet.md`.

**To update the Cheat Sheet:**
\`\`\`bash
# 1. Compile the extraction prompt
lync build extract-cheat-sheet.lync.md -o .

# 2. Feed 'extract-cheat-sheet.md' to your preferred LLM (e.g., ChatGPT, Claude)
# 3. Save the LLM's raw markdown output as 'cheat-sheet.md' in this directory.
\`\`\`

#### 2. The Main Skill (`main.lync.md`)
This file defines the strict Persona and ruleset for the AI Editor. It uses `@import:inline` to pull in the `cheat-sheet.md` generated in the previous step.

#### 3. Final Build (`lync build`)
To package all components into the final, redistributable `lync-expert.md`:

\`\`\`bash
lync build
\`\`\`
*(This directory contains a `lync-build.yaml` configured to compile `main.lync.md` directly into `lync-expert.md`).*

> **Note:** The pre-compiled `lync-expert.md` is already committed to this repository. You only need to run this pipeline if the core Lync `HELP.md` or `DESIGN.md` documentation has significantly changed.

---

<a name="chinese"></a>
## 🇨🇳 中文

本目录包含用于生成 `lync-expert.md` 的核心组件与自动化构建管线。生成出的文件是一个极度浓缩的**独立系统提示词 (System Prompt)**，专供 Cursor、Windsurf 或 Copilot 等 AI 代码编辑器使用。

当你将 `lync-expert.md` 提供给你的编辑器（例如放入项目的 `.cursorrules` 文件中）后，AI 会立刻获得专业知识储备，精通如何理解、编写以及调试基于 AST 语法的 Lync Markdown 提示词。

### ⚙️ 工作原理 (自托管提取管线)

为了避免在 Lync 核心语法发生变更时还要人工维护速查表，本仓库利用了 Lync 本身的编译能力，实现了“动态提取与自我文档化”。

#### 1. 知识提取器 (`extract-cheat-sheet.lync.md`)
这是一个专用的提取提示词文件。它利用 Lync 的 `@import:inline` 语法，动态将根目录中详尽的 `HELP.md` 和 `DESIGN.en.md` 全文注入其中，并指挥大模型阅读这些长文档，从中提炼出一份极其精简的 `cheat-sheet.md` (语法速查表)。

**如何更新速查表:**
\`\`\`bash
# 1. 编译提取器
lync build extract-cheat-sheet.lync.md -o .

# 2. 将编译出的 'extract-cheat-sheet.md' 发送给常用的大语言模型 (如 ChatGPT, Claude)
# 3. 将 AI 返回的 markdown 原文覆盖保存为本目录下的 'cheat-sheet.md'
\`\`\`

#### 2. 核心技能定义 (`main.lync.md`)
该文件为 AI 编辑器定义了极其严格的 Persona（角色设定）与规则集。它进一步通过 `@import:inline` 引入了你在上一步中随时更新得到的 `cheat-sheet.md` 速查表。

#### 3. 终极打包构建 (`lync build`)
要将所有的上下文组装并打包成最终可分发的单一文件 `lync-expert.md`，只需执行：

\`\`\`bash
lync build
\`\`\`
*(由于本目录内置了 `lync-build.yaml` 映射规则，直接运行命令即会自动读取 `main.lync.md` 并输出到 `lync-expert.md`)*

> **说明：** 预编译好的 `lync-expert.md` 已提交至代码库中。只有在 Lync 底层的 `HELP.md` 或 `DESIGN.md` 等核心文档发生重大架构演进时，才需要重新触发此管线。
