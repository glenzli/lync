---
vasm:
  compile:
    format: "informational"
    targetLangs: ["zh-CN", "en"]
---

# VASMC

![VASMC 编译流程](docs/assets/vasmc-banner.png)

VASMC 是用于 prompt、skill 和 AI 项目文档的 Markdown 编译器。它把 `.vasm.md` 源文件展开为 `.md` 产物，并把需要继续处理的事项写入 `.vasmc/build-report.yaml`。

`@vasm/cli` 负责 import 展开、依赖锁定、语言过滤、输出路由和策略诊断等确定性工作，不调用模型。翻译、语义审查和项目上下文检查由执行构建的 AI 编辑器或开发者根据报告完成。

## 快速开始

```bash
npm install -g @vasm/cli
vasmc init
vasmc build
```

最小源文件：

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

构建会生成：

- 编译后的 Markdown；
- `.vasmc/build-report.yaml`，按需列出校验、翻译、策略审查等后续事项。

`.vasm.md` 是维护入口，生成的 `.md` 是构建产物。除报告明确要求更新译文外，内容修改应回到源文件后重新构建。

## 能力边界

- `vasmc build` 不调用模型，报告中的 action 也不表示相关任务已经完成。
- 策略检查覆盖 manifest、依赖、格式边界和内容信号，不是运行时安全沙箱。
- `vasm-console` 提供可选的外部模型语义检查，与确定性编译链分开。

## 文档

| 文档 | 内容 |
| --- | --- |
| [使用手册](docs/USAGE.vasm.md) | 项目配置、构建流程和示例。 |
| [AI 工作流](docs/AI-WORKFLOW.vasm.md) | 如何处理 build report 中的 action。 |
| [协议参考](docs/REFERENCE.vasm.md) | Manifest、import、构建配置、报告和策略诊断。 |
| [CLI 帮助](HELP.vasm.md) | `vasmc` 与 `vasm-console` 命令。 |
| [设计文档](DESIGN.vasm.md) | 编译模型与设计边界。 |

## 包

| 包 | 命令 | 职责 |
| --- | --- | --- |
| `@vasm/core` | 无 | 编译器与协议实现。 |
| `@vasm/cli` | `vasmc` | 构建、依赖管理和报告生成。 |
| `@vasm/console` | `vasm-console` | 可选的外部模型 lint 与 diff。 |

## 开发与发布

```bash
npm install
npm test
npm run build
npm run release:check
npm run release -- --dry-run
```

`npm run release` 默认发布到 npmjs、GitHub 和 GitLab。可使用 `--only` 选择目标，或使用 `--skip` 排除目标。
