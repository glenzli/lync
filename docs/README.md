# VASMC Documentation

[🌍 English](#en) | [🇨🇳 中文](#zh-cn)

---

<a name="en"></a>

## 🌍 English

This directory contains generated documentation. Maintain the source files in `vasm/docs/`; do not edit `docs/*.md` directly.

## Reading Order

1. [Usage Guide](USAGE.md): starts from a minimal project and shows `.vasm.md` source, `vasmc-build.yaml`, compiled output, and build report behavior.
2. [AI Workflow](AI-WORKFLOW.md): explains how AI editors should read `.vasmc/build-report.yaml` and execute verify, integration-guidance, translate, refresh-translation, tree-shake, policy, and project review actions.
3. [Protocol Reference](REFERENCE.md): lists manifest fields, imports, language blocks, build config, report actions, policy diagnostics, and content signals.
4. [Help](../HELP.md): CLI command reference.
5. [Design](../DESIGN.md): current architecture, format boundaries, AI build report, policy gate, and self-evaluation flow.

## Source File Rule

- Edit `vasm/docs/**/*.vasm.md`.
- Run `node packages/cli/dist/index.js build` or `vasmc build`.
- Review generated `docs/**/*.md` and `.vasmc/build-report.yaml`.
- Do not directly edit generated `docs/**/*.md`.

---

<a name="zh-cn"></a>

## 🇨🇳 中文

这个目录是生成态文档入口。维护对象在 `vasm/docs/`，不要直接编辑 `docs/*.md`。

## 阅读顺序

1. [使用手册](USAGE.md)：从最小项目开始，展示 `.vasm.md` source、`vasmc-build.yaml`、编译产物和 build report 的实际效果。
2. [AI 工作流](AI-WORKFLOW.md)：说明 AI 编辑器如何读取 `.vasmc/build-report.yaml`，执行 verify、integration\_guidance、translate、refresh\_translation、tree-shake、policy 和 project review。
3. [协议参考](REFERENCE.md)：完整列出 manifest、import、语言块、build config、report actions、policy diagnostics 和 content signals。
4. [帮助文档](../root/HELP.md)：CLI 命令速查。
5. [设计文档](../root/DESIGN.md)：当前架构、format 边界、AI build report、policy gate 和自评估流程。

## 源文件优先

- 编辑 `vasm/docs/**/*.vasm.md`。
- 运行 `node packages/cli/dist/index.js build` 或 `vasmc build`。
- 检查生成的 `docs/**/*.md` 和 `.vasmc/build-report.yaml`。
- 不要直接修改生成的 `docs/**/*.md`。
