---
vasm:
  compile:
    format: "informational"
    targetLangs: ["en", "zh-CN"]
---

# VASMC 文档

这个目录是生成态文档入口。维护对象在 `docs-src/`，不要直接编辑 `docs/*.md`。

## 阅读顺序

1. [使用手册](USAGE.vasm.md)：从最小项目开始，展示 `.vasm.md` source、`vasmc-build.yaml`、编译产物和 build report 的实际效果。
2. [AI 工作流](AI-WORKFLOW.vasm.md)：说明 AI 编辑器如何读取 `.vasmc/build-report.yaml`，执行 verify、integration_guidance、translate、refresh_translation、tree-shake、policy 和 project review。
3. [协议参考](REFERENCE.vasm.md)：完整列出 manifest、import、语言块、build config、report actions、policy diagnostics 和 content signals。
4. [帮助文档](../HELP.vasm.md)：CLI 命令速查。
5. [设计文档](../DESIGN.vasm.md)：当前架构、format 边界、AI build report、policy gate 和自评估流程。

## 源文件优先

- 编辑 `docs-src/**/*.vasm.md`。
- 运行 `node packages/cli/dist/index.js build` 或 `vasmc build`。
- 检查生成的 `docs/**/*.md` 和 `.vasmc/build-report.yaml`。
- 不要直接修改生成的 `docs/**/*.md`。
