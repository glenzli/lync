---
vasm:
  compile:
    format: "doc"
    targetLangs: ["zh-CN"]
---

# @vasm/core

`@vasm/core` 是 VASMC 的确定性编译核心。它承载 VASM 协议解析、Frontmatter 处理、依赖图遍历、`@import` 展开、语言块过滤、工作区构建和输出合并逻辑。

这个包不包含外部模型 SDK，不读取 `llm` 配置，也不执行语义校验或自动翻译。需要人类辅助的 LLM 工具时，请使用 `@vasm/console`；需要给 AI 编辑器生成工作单时，请使用 `@vasm/cli` 的 `vasmc build`。

[VASM 核心语法](./fragments/syntax.vasm.md "@import:inline")
