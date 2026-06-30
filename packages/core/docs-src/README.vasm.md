---
vasm:
  compile:
    format: "informational"
    targetLangs: ["en", "zh-CN"]
---

<!-- lang:en -->
# @vasm/core

`@vasm/core` is the deterministic compiler core for VASMC. It implements VASM frontmatter parsing, manifest validation, dependency graph traversal, `@import` expansion, language-block filtering, workspace builds, merged doc output, policy diagnostics, and project-review context generation.

This package does not include external model SDKs, does not read `llm` configuration, and does not run semantic linting or automatic translation. Use `@vasm/console` for human-facing optional LLM tools, and use `@vasm/cli` when an AI editor needs `vasmc build` report actions.

### Install

```bash
npm install @vasm/core
```

### Package Boundary

`@vasm/core` owns the deterministic VASM protocol implementation:

* YAML frontmatter parsing and `vasm` metadata normalization.
* Dependency graph collection and local/remote module resolution.
* `@import:link` and `@import:inline` expansion.
* `<!-- lang:xx -->` block filtering and multi-language doc merging.
* Workspace build routing through `vasmc-build.yaml`.
* Manifest validation, policy diagnostics, format-boundary checks, and project-review context indexing.

It intentionally does not own command-line UX, npm publishing flow, or optional external-model tools.

### Import Syntax

```markdown
[link text](vasm:alias "@vasm-directive")
```

* **`@import:link`** rewrites `vasm:alias` to the local relative path of the resolved file while preserving the Markdown link.
* **`@import:inline`** replaces the link with the full text content of the referenced module, which is useful for assembling large prompt contexts.

### Cross-Compilation

VASMC supports language-specific Markdown blocks:

```markdown
# Shared System Rule

<!-- lang:en -->
Explain the code step by step.
<!-- /lang -->

<!-- lang:zh-CN -->
请逐步解释代码。
<!-- /lang -->
```

When a target language is selected, the compiler keeps the matching block and removes the others. For `informational` outputs with multiple `targetLangs`, VASMC merges the compiled language variants into one Markdown document with language navigation.

### Manifest And Policy

VASM frontmatter is intentionally small: `alias`, `version`, `intent`, `compile`, and `dependencies`. `@vasm/core` evaluates deterministic policy signals and emits structured diagnostics:

* `pass`: no deterministic policy risk.
* `review`: output is allowed, but an AI or human should inspect the diagnostics.
* `blocked`: a deterministic blocking risk exists, such as a manifest structure error, lockfile hash mismatch, or an informational output importing active AI guidance.

`compile.format` accepts `informational`, `executable`, and `integrative`. Deprecated `doc` and `prompt` values are normalized with warnings.
<!-- /lang -->

<!-- lang:zh-CN -->
# @vasm/core

`@vasm/core` 是 VASMC 的确定性编译核心。它承载 VASM 协议解析、Frontmatter 处理、依赖图遍历、`@import` 展开、语言块过滤、工作区构建和输出合并逻辑。

这个包不包含外部模型 SDK，不读取 `llm` 配置，也不执行语义校验或自动翻译。需要人类辅助的 LLM 工具时，请使用 `@vasm/console`；需要给 AI 编辑器生成结构化 report actions 时，请使用 `@vasm/cli` 的 `vasmc build`。

[VASM 核心语法](./fragments/syntax.vasm.md "@import:inline")
<!-- /lang -->
