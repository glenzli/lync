---
vasm:
  compile:
    format: "informational"
    targetLangs: ["en", "zh-CN"]
---

# VASMC

![VASMC 编译流程图](docs/assets/vasmc-banner.png)

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

- 给目标 AI 直接读取的纯净 Markdown 产物。
- `.vasmc/build-report.yaml`，包含 `verify`、`translate`、`refresh_translation`、`tree_shake`、`policy_review`、`policy_gate`、`project_review` 等结构化 actions。
- 源文件优先：生成的 `.md` 是审查证据，修复通常回到 `.vasm.md` source。

## 文档入口

| 文档 | 用途 |
| --- | --- |
| [使用手册](docs/USAGE.vasm.md) | 带完整 source 到 output 示例的主教程。 |
| [AI 工作流](docs/AI-WORKFLOW.vasm.md) | AI 编辑器如何执行 build report actions。 |
| [协议参考](docs/REFERENCE.vasm.md) | Manifest、import、build config、report actions、policy diagnostics 和 content signals。 |
| [CLI 帮助](HELP.vasm.md) | `vasmc` 与 `vasm-console` 命令参考。 |
| [设计文档](DESIGN.vasm.md) | 设计哲学与编译器模型。 |

## 包边界

| 包 | 命令 | 职责 |
| --- | --- | --- |
| `@vasm/core` | 无 | 共享确定性编译核心。 |
| `@vasm/cli` | `vasmc` | 面向 AI 的 build、依赖管理和结构化 report actions。 |
| `@vasm/console` | `vasm-console` | 面向人类的可选外部模型控制台工具。 |

## 发布

本仓库使用 Changesets。发布前运行 `npm run release:check`。统一发布入口是：

```bash
npm run release
npm run release -- --only npm
npm run release -- --only gitlab,npm
npm run release -- --skip github
npm run release -- --dry-run
```

默认目标是 npmjs、GitHub 和 GitLab。`--only` 用于只选择部分目标，`--skip` 用于从默认目标中排除部分目标；脚本会创建 `v<version>` 聚合 tag 和 package tags，并按目标发布 npm 包、推送 tag、创建 GitHub/GitLab release。
