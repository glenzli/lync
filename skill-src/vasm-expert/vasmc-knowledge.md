# VASMC 知识手册（AI 编辑器专用）


***

## 第一章：VASMC 是什么

**VASMC 是专为 LLM Prompt 工程设计的静态编译器/链接器。**

核心边界：`.vasm.md` 是人类维护的 source，`.md` 是编译产物。两者职责严格分离；AI 协调器根据 `.vasmc/build-report.yaml` 的结构化 actions 做校验、翻译、整合审核和源文件级建议。

编译过程是**纯确定性的 AST 组装**：解析 `@import` 依赖、交叉编译语种，无任何非确定性操作。

**AI 编辑器的角色**：运行 `vasmc build` 后，VASMC 完成 AST 组装、写入确定性产物并生成 `.vasmc/build-report.yaml`，你负责读取其中的 `actions` 并处理后续语义任务（校验、按 intent 检查、翻译、刷新旧译文、Diff）。除 `translate` action 明确要求写目标语言产物，或 `refresh_translation` action 要求检查并更新已保留目标语种段外，语义修复和精简都应回到 `.vasm.md` source、fragment、manifest 或 build config。

***

## 第二章：项目结构与文件职责

```
project-root/
├── vasmc.yaml             # 远程依赖声明（URL → 本地 Alias 映射）
├── vasmc-lock.yaml        # SHA-256 Hash 锁文件（提交到版本控制）
├── vasmc-build.yaml       # 工作区编译配置（includes、output、routing、targetLangs）
├── .vasmc/                # ⚠️ 内部缓存 + 临时产物（加入 .gitignore）
│   ├── <alias>.md         # vasmc sync 下载的纯缓存依赖
│   ├── build-report.yaml      # 结构化构建报告、actions、policy 状态与依赖摘要
│   └── project-review-context.yaml  # 可选项目感知审查索引
└── src/
    ├── persona.vasm.md    # 源文件（含 Frontmatter + @import 指令）
    └── main.vasm.md       # 主入口源文件
```

产物文件（`*.md`，无 `.vasm.` 中缀）是纯净的编译输出，供 LLM 直接消费，**禁止手工修改**。

**三种编译格式**（在 Frontmatter 的 `compile.format` 中声明）：

| 格式 | 用途 | 特点 |
|------|------|------|
| `informational` | README、HELP、DESIGN 等信息/文档 | 多语种合并输出 |
| `executable` | System Prompt、技能文件等 AI 指令内容 | 多语种时每种语种独立输出，产物纯净无元数据 |
| `integrative` | 指导一组 VASM 模块如何组合 | source-only，不生成自己的 compiled output；用 `integration.appliesTo` 声明适用对象 |

***

`informational` 输出在 AI build 模式下会复用既有合并文档中的旧目标语种段。比如 source 只维护中文、输出已有人维护过英文时，VASMC 会保留英文段并生成 `refresh_translation` action，要求 AI 检查旧英文是否仍然匹配新的中文 source。

## 第三章：语法速查（含示例）

### @import 引入指令

**语法格式**：`[链接文本](vasm:alias "@vasm-directive")`

**`@import:inline`** — 内联展开，将目标文件的完整内容替换到当前位置：
```markdown
<!-- 通过别名引入（需在 vasmc.yaml 注册） -->
[技能内容](vasm:my-skill "@import:inline")
```

**`@import:link`** — 链接重写，将 `vasm:alias` 或本地 `.vasm.md` source 引用替换为生成 `.md` 的相对路径，保留超链接结构：
```markdown
[技能链接](vasm:my-skill "@import:link")
<!-- 编译输出：[技能链接](./skills/my-skill.md) -->
```

如果使用本地相对路径并希望链接可点击，目标 source 也必须被同一次 workspace build 或前置 build 编译成对应 `.md`。

**本地相对路径引用**（无需在 `vasmc.yaml` 注册，直接使用 `./` 相对路径）：
```markdown
[人格设定](./fragments/persona.vasm.md "@import:inline")
```

### 多语种编译区块

```markdown
<!-- lang:zh-CN -->
这是中文内容，仅出现在 zh-CN 产物中。
<!-- /lang -->

<!-- lang:en -->
This is English content, only in the `en` output.
<!-- /lang -->

这一行没有被 lang 块包裹，会出现在**所有语种**产物中。
```

### 模块 Frontmatter 协议

```yaml
---
vasm:
  alias: "my-module"          # vasmc add 时自动采用此字段作为本地别名
  version: "1.0.0"            # 供人类评估兼容性（确定性锁定以内容 hash 为准）
  intent: "Assemble a security-focused code review prompt."
  dependencies:
    anti-delusion: "https://example.com/system.md"  # 嵌套依赖，vasmc sync 自动扁平安装
  compile:
    format: executable        # informational | executable | integrative
    targetLangs: ["zh-CN"]    # 目标交叉编译语种
---
```

整合指导文件应使用 `compile.format: integrative`，并在需要指导具体 prompt/skill 组合时声明适用对象：

```yaml
---
vasm:
  alias: "reviewer-integration-guide"
  intent: "Guide how reviewer-related VASM modules should be combined."
  compile:
    format: integrative
  integration:
    appliesTo:
      - vasm:security-reviewer
      - skill-src/reviewer/**/*.vasm.md
---
```

`appliesTo` 支持 `vasm:<alias>`，也支持 source/output 路径 glob。它是 AI 整合提示关系，不是 `@import` 内容依赖。

***

## 第四章：AI 专用 CLI 命令

**AI 编辑器优先使用以下命令**（`vasm-console lint/diff` 是人类可选外部模型工具）：

| 命令 | 说明 |
|------|------|
| `vasmc build <file>` | AI 编辑器的唯一编译入口，输出产物和 `.vasmc/build-report.yaml` |
| `vasmc build --dry-run` | 生成 report plan，默认输出到 stdout，不写产物、默认 report 或 build-state |
| `vasmc build --force` | 忽略 build-state，强制重新构建未变化 entry |
| `vasmc expand <file> --target-lang <lang> --stdout` | 纯展开 source，不走 workspace routing、build-state 或 build report |
| `vasmc graph <file>` | 静态分析依赖 AST 树，排查循环依赖或缺失文件 |
| `vasmc init` | 在当前目录生成默认 `vasmc-build.yaml` 配置模板 |
| `vasmc add <url>` | 下载远程模块并注册到 `vasmc.yaml`（支持 `--alias`、`--dest`） |
| `vasmc sync` | 根据 `vasmc.yaml` 安装所有缺失依赖，生成/更新 `vasmc-lock.yaml` |
| `vasmc seal <patterns>` | 将普通 Markdown 封装为 VASM 模块（注入 Frontmatter、重命名为 `.vasm.md`） |

***

**注意事项**：

* `@import:inline` 嵌套超过 3 层会导致 LLM 注意力缺失（幻觉），建议扁平化架构。
* 远程依赖通过 Hash 锁定，内容变更需执行 `vasmc update <alias>` 或 `vasmc update` 才生效。
* `--out-dir` 不是 dry-run；命中 `routing` 时，最终路径仍由 `routing.dest` 决定。
* 需要无副作用检查时，使用 `vasmc build --dry-run`；需要临时展开稿时，使用 `vasmc expand ... --stdout`。
* `executable` 格式文件内部所有内联素材必须与目标编译语种一致，避免混杂多语言。
* `integrative` 只用于组合指导，是 source-only 文件；不要把它直接当最终可执行 prompt，也不要期待它生成独立产物。
* 创建 integrative source 时，如果它是为某个 prompt/skill 或一组 VASM 文件服务的，必须写 `vasm.integration.appliesTo`；不要通过 `@import:inline` 把整合指导塞进最终 executable。
* 如果 `.vasmc/build-report.yaml` 的 actions 出现 `integration_guidance`，在组合目标产物前必须读取 action 中的 `guides[].source`。
* `.vasmc/build-report.yaml` 中的 `policy.status` 可为 `pass`、`review`、`blocked`。若出现 Policy Gate，说明确定性 policy 已发现阻断风险；在 `security.mode: enforce` 下，blocked executable 输出不会被更新。integrative source 不产生输出，只报告 policy。
* 如果 `.vasmc/build-report.yaml` 的 actions 出现 `policy_review` 或 `policy_gate`，必须重点检查 manifest、lockfile、format 边界 diagnostics。若存在 `policy.contentSignals`，把它们当作词面线索，判断 evidence 是 active instruction、prohibition、example 还是 documentation。
* 若启用 `ai.projectReview`，必须读取 `.vasmc/project-review-context.yaml`，结合项目 README、docs、package 配置和 VASM 源文件提出源文件级建议，不要直接编辑生成物。
* `tree_shake` 是条件性 action；只有用户明确要求优化或精简 Prompt 时才执行，并且应裁剪 source 或 fragment 后重新 build。
