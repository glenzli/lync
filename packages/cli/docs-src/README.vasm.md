---
vasm:
  compile:
    format: "doc"
    targetLangs: ["zh-CN"]
---

# @vasm/cli

`@vasm/cli` 发布 `vasmc` 命令，是 VASMC 的 AI-facing 编译入口。它将 `.vasm.md` 源文件编译为纯净 Markdown 产物，并在 `build` 时生成 `.vasmc/build-instructions.md`，让当前 AI 继续处理语义任务。

[CLI 使用说明](./fragments/cli.vasm.md "@import:inline")

[AI Build 工作流](./fragments/ai-build.vasm.md "@import:inline")
