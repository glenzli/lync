# VASMC

[🌍 English](#en) | [🇨🇳 中文](#zh-cn)

***

<a name="en"></a>

## 🌍 English

Decentralized Markdown prompt compiler for LLM skills and AI-facing documents.

VASMC treats Markdown prompts, skills, and documentation as source code. You maintain `.vasm.md` files, declare imports and output intent, then run `vasmc build` to produce clean `.md` outputs plus a structured `.vasmc/build-report.yaml` for the current AI editor to review, translate, trim, or block.

## Quick Start

```bash
npm install -g @vasm/cli
vasmc init
vasmc build
```

Minimal source:

```markdown
---
vasm:
  alias: release-reviewer
  intent: "Review release notes against source changes."
  compile:
    format: executable
    targetLangs: ["en"]
---

# Release Reviewer

[Rules](./fragments/release-rules.vasm.md "@import:inline")
```

Build result:

* Clean Markdown output for the target AI.
* `.vasmc/build-report.yaml` with deterministic report actions such as `verify`, `translate`, `tree_shake`, `policy_review`, `policy_gate`, and `project_review`.
* Source-first workflow: generated `.md` files are review evidence, while fixes normally go back to `.vasm.md` source files.

## Documentation

| Document | Purpose |
| --- | --- |
| [Usage Guide](docs/USAGE.md) | Full source-to-output guide with practical examples. |
| [AI Workflow](docs/AI-WORKFLOW.md) | How an AI editor should execute build report actions. |
| [Protocol Reference](docs/REFERENCE.md) | Manifest, imports, build config, report actions, and policy diagnostics. |
| [CLI Help](HELP.md) | Command reference for `vasmc` and `vasm-console`. |
| [Design](DESIGN.md) | Design philosophy and compiler model. |

## Packages

| Package | Command | Role |
| --- | --- | --- |
| `@vasm/core` | none | Shared deterministic compiler core. |
| `@vasm/cli` | `vasmc` | AI-facing build, dependency management, and structured report actions. |
| `@vasm/console` | `vasm-console` | Human-facing optional external-model console tools. |

## Release

This repository uses Changesets. Run `npm run release:check` before publishing; use `npm run release:publish` for npm release and `npm run release:github` for GitHub tag/release automation.

***

<a name="zh-cn"></a>

## 🇨🇳 中文

面向 LLM skill、prompt 和 AI 文档的去中心化 Markdown prompt 编译器。

VASMC 把 Markdown prompt、skill 和文档当作 source code 维护。你编辑 `.vasm.md`，声明 import 和输出用途，然后运行 `vasmc build` 生成纯净 `.md` 产物，并生成 `.vasmc/build-report.yaml`，交给当前 AI 编辑器继续校验、翻译、精简或阻断。

## 快速开始

```bash
npm install -g @vasm/cli
vasmc init
vasmc build
```

最小 source：

```markdown
---
vasm:
  alias: release-reviewer
  intent: "Review release notes against source changes."
  compile:
    format: executable
    targetLangs: ["en"]
---

# Release Reviewer

[Rules](./fragments/release-rules.vasm.md "@import:inline")
```

构建后得到：

* 给目标 AI 直接读取的纯净 Markdown 产物。
* `.vasmc/build-report.yaml`，包含 `verify`、`translate`、`tree_shake`、`policy_review`、`policy_gate`、`project_review` 等结构化 actions。
* source-first 工作流：生成的 `.md` 是审查证据，修复通常回到 `.vasm.md` source。

## 文档入口

| 文档 | 用途 |
| --- | --- |
| [使用手册](docs/USAGE.md) | 带完整 source 到 output 示例的主教程。 |
| [AI 工作流](docs/AI-WORKFLOW.md) | AI 编辑器如何执行 build report actions。 |
| [协议参考](docs/REFERENCE.md) | Manifest、import、build config、report actions 和 policy diagnostics。 |
| [CLI 帮助](HELP.md) | `vasmc` 与 `vasm-console` 命令参考。 |
| [设计文档](DESIGN.md) | 设计哲学与编译器模型。 |

## 包边界

| 包 | 命令 | 职责 |
| --- | --- | --- |
| `@vasm/core` | 无 | 共享确定性编译核心。 |
| `@vasm/cli` | `vasmc` | 面向 AI 的 build、依赖管理和结构化 report actions。 |
| `@vasm/console` | `vasm-console` | 面向人类的可选外部模型控制台工具。 |

## 发布

本仓库使用 Changesets。发布前运行 `npm run release:check`；npm 发布使用 `npm run release:publish`，GitHub tag/release 自动化使用 `npm run release:github`。
