# Lync 

🌍 [English](#english) | 🇨🇳 [中文](#chinese)

---

<a name="english"></a>
## 🌍 English

Lync is a lightweight, decentralized package manager and compiler designed specifically for Markdown files in the era of Large Language Models (LLMs). 

As LLMs increasingly use Markdown for logic control (e.g., Prompts, System Instructions), Markdown has effectively evolved into **source code**. Lync treats Markdown as such, providing robust mechanisms for dependency management, inline composition, and deterministic builds—**all without relying on any centralized registries like npmjs.**

👉 [Read the Full English Design Spec](DESIGN.en.md)

### 🌟 Core Design

The core design principle is **graceful degradation**. Compilation directives are encoded within standard Markdown link attributes (`[Title](lync:alias "@import:inline")`) to ensure uncompiled source files remain readable in generic viewers (like GitHub or Obsidian).

### 📦 Features

*   **Decentralized Package Management**: Install remote Markdown files directly via their URLs without relying on a central registry.
*   **Alias-Driven Dependency Management**: Use `lync.yaml` to map URLs to local aliases (e.g., `lync:coder-skill`), avoiding URL scattering and naming collisions.
*   **Deterministic Builds**: The `lync-lock.yaml` locks SHA-256 hashes of remote files to ensure reproducible builds.
*   **Native Multilingual i18n**: Support for AST-level multi-language block extraction and intelligent LLM rollback translations.
*   **Two Import Modes**:
    *   `@import:link` (Link Rewrite): Rewrites virtual aliases to local physical paths, preserving hyperlink structure.
    *   `@import:inline` (Inline Expansion): Injects remote text in-place, suitable for assembling large prompt contexts.

### 🚀 Quick Start & CLI Usage

For detailed CLI usage, initialization, compilation, and advanced workspace configurations, please refer to our dedicated **[Help & Usage Documentation](HELP.md)**.

---

<a name="chinese"></a>
## 🇨🇳 中文

Lync 是一个专为大语言模型 (LLM) 时代设计的轻量级、去中心化 Markdown 包管理器与编译器。

随着 LLM 越来越多地将 Markdown 作为逻辑指令语言（例如 Prompt、System Instructions），Markdown 实际上已经演变为了**源代码**。Lync 为这些“源码”提供健全的依赖管理、内联组合和确定性构建机制，**且完全不依赖任何类似 npmjs 的中心化注册表**。

👉 [阅读完整的中文设计规范](DESIGN.zh.md)

### 🌟 核心设计

Lync 采用**向下兼容 (Graceful Degradation)** 的设计原则。编译指令被编码为标准 Markdown 链接的属性 (`[别名](lync:alias "@import:inline")`)，以确保未编译的源文件在通用阅读器（如 GitHub 或 Obsidian）中保持可读。

### 📦 核心特性

*   **去中心化包管理**: 直接通过目标 URL 拉取和安装 Markdown 文件，无需引入中心化注册表。
*   **基于别名的依赖管理**: 通过 `lync.yaml` 将 URL 绑定到本地别名（例如 `lync:coder-skill`），避免 URL 散落和命名冲突。
*   **确定性构建**: 通过 `lync-lock.yaml` 锁定远程文件的 SHA-256 哈希值，确保构建的确定性。
*   **原生多语种分发 (i18n)**: AST 级圈选语言块生成多语言版本；对于未覆盖的语种，支持自动唤起 LLM 动态精确回译。
*   **双模式引入机制**:
    *   `@import:link` (链接重写): 将虚拟别名重写为本地相对物理路径，保留超链接结构。
    *   `@import:inline` (内联展开): 提取远程文本并替换当前引用，适用于组装大型 Prompt 上下文。

### 🚀 快速上手与 CLI 用法

有关 CLI 使用、初始化、编译命令以及高级工作区配置的详细信息，请参阅我们专属的 **[帮助与用法文档](HELP.md)**。

---
