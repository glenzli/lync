# Lync Expert Skill Pipeline
*(English / 中文)*

This directory contains the necessary components and pipeline to generate `lync-expert.md`, a highly-condensed **standalone System Prompt** designed for AI code editors (like Cursor, Windsurf, or Copilot).
本目录包含用于生成 `lync-expert.md` 的核心组件与自动化构建管线。生成出的文件是一个极度浓缩的**独立系统提示词 (System Prompt)**，专供 Cursor、Windsurf 或 Copilot 等 AI 代码编辑器使用。

When you feed `lync-expert.md` to your editor (e.g., placing it in `.cursorrules`), the AI instantly becomes a master at comprehending, writing, and debugging Lync's AST-based markdown prompts.
当你将 `lync-expert.md` 喂给你的编辑器（例如放入项目的 `.cursorrules` 文件中）后，AI 会立刻化身为 Lync 大师，精通如何理解、编写以及调试基于 AST 语法的 Markdown 提示词。

## How it works (The Dogfooding Pipeline) / 工作原理 (吃自己的狗粮)

Instead of manually maintaining a cheat sheet when Lync's overarching syntax changes, this repository uses Lync to document Lync.
为了避免在 Lync 语法发生变更时还要手动维护一份速查表，本仓库利用了 Lync 本身的编译能力来“编译 Lync 的文档”。

### 1. The Extraction Prompt (`extract-cheat-sheet.lync.md`) / 知识提取器
This file is an extraction prompt. It utilizes Lync's `@import:inline` to dynamically suck in the entirety of the project's root `HELP.md` and `DESIGN.en.md`.
It instructs an LLM to read these massive documents and distill them into an ultra-concise `cheat-sheet.md`.
这是一个提取提示词文件。它利用 Lync 的 `@import:inline` 语法，动态将根目录中庞大的 `HELP.md` 和 `DESIGN.en.md` 全文吸纳进来，并指挥大模型阅读这些巨型文档，从中提炼出一份极其精简的 `cheat-sheet.md` (速查表)。

**To update the Cheat Sheet / 如何更新速查表:**
\`\`\`bash
# 1. Compile the extraction prompt / 编译提取器
lync build extract-cheat-sheet.lync.md -o .

# 2. Feed 'extract-cheat-sheet.md' to your favorite LLM / 丢给大模型 (ChatGPT, Claude)
# 3. Save the LLM's raw markdown output as 'cheat-sheet.md' / 将 AI 返回的 markdown 原文保存为本目录下的 cheat-sheet.md
\`\`\`

### 2. The Main Skill (`main.lync.md`) / 核心技能定义
This file defines the strict Persona and ruleset for the AI Editor. It uses `@import:inline` to pull in the `cheat-sheet.md` you generated in the previous step.
该文件为 AI 编辑器定义了极其严格的 Persona（角色）与规则集。它进一步通过 `@import:inline` 引入了你在上一步生成的 `cheat-sheet.md` 速查表。

### 3. Final Build / 终极构建 (`lync build`)
To package everything into the final, redistributable `lync-expert.md`:
要将所有碎片打包成最终可分发的单一文件 `lync-expert.md`，只需执行：

\`\`\`bash
lync build
\`\`\`
*(This directory contains a `lync-build.yaml` configured to compile `main.lync.md` directly into `lync-expert.md` in this folder).*
*(由于本目录内置了 `lync-build.yaml`，直接运行会自动找到 `main.lync.md` 并映射输出到 `lync-expert.md`)*

---

> **Note:** The pre-compiled `lync-expert.md` is already committed to this repository. You only need to run this pipeline if the core Lync `HELP.md` or `DESIGN.md` documentation has significantly changed.
> **注意：** 预编译好的 `lync-expert.md` 已经被提交到了代码库中。只有当 Lync 底层的 `HELP.md` 或 `DESIGN.md` 核心文档发生了重大的语法调整时，你才需要重新跑一遍这个管线。
