# VASMC 知识手册（AI Agent 专用）

***

## 第一章：VASMC 是什么（心智模型）

**VASMC 是专为 LLM Prompt 工程设计的静态编译器/链接器。**

核心类比：`.vasm.md` 是人类编写的**源码**（意图/高级语言），`.md` 是编译产物（**机器码**）。两者职责严格分离——**人类禁止手工修改产物文件**；AI 协调器在 `fix: auto` 模式下可直接编辑产物，其他情况下也应以修改产物为目标，不改源文件。

编译过程是**纯确定性的 AST 组装**：解析 `@import` 依赖、交叉编译语种，无任何非确定性操作。

**AI 编辑器的角色**：你是智能的大脑，VASMC 是确定性的肌肉。运行 `vasmc agent` 后，VASMC 完成 AST 组装并生成 `.vasmc/agent-instructions.md`，你负责接管后续语义任务（校验、意图对齐验证、产物修复、翻译、Diff）。

***

## 第二章：项目结构与文件职责

```
project-root/
├── vasmc.yaml             # 远程依赖声明（URL → 本地 Alias 映射）
├── vasmc-lock.yaml        # SHA-256 Hash 锁文件（提交到版本控制）
├── vasmc-build.yaml       # 工作区编译配置（includes、output、routing、targetLangs）
├── .vasmc/                # ⚠️ 内部缓存 + 临时产物（加入 .gitignore）
│   ├── <alias>.md         # vasmc sync 下载的纯缓存依赖
│   └── agent-instructions.md  # vasmc agent 的 AI 编排指令清单
└── src/
    ├── persona.vasm.md    # 源文件（含 Frontmatter + @import 指令）
    └── main.vasm.md       # 主入口源文件
```

产物文件（`*.md`，无 `.vasm.` 中缀）是纯净的编译输出，供 LLM 直接消费，**禁止手工修改**。

**两种编译格式**（在 Frontmatter 的 `compile.format` 中声明）：

| 格式 | 用途 | 特点 |
|------|------|------|
| `prompt` | System Prompt、技能文件等 AI 消费 | 单语种输出，产物纯净无元数据 |
| `doc` | README、HELP、DESIGN 等人类文档 | 多语种合并输出 |

***

## 第三章：语法速查（含示例）

### @import 引入指令

**语法格式**：`[链接文本](vasm:alias "@vasm-directive")`

**`@import:inline`** — 内联展开，将目标文件的完整内容替换到当前位置：
```markdown
<!-- 通过别名引入（需在 vasmc.yaml 注册） -->
[技能内容](vasm:my-skill "@import:inline")
```

**`@import:link`** — 链接重写，将 `vasm:alias` 替换为本地相对物理路径，保留超链接结构：
```markdown
[技能链接](vasm:my-skill "@import:link")
<!-- 编译输出：[技能链接](./skills/my-skill.md) -->
```

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
  version: "1.0.0"            # 供人类评估兼容性（引擎以 Hash 为唯一真理）
  dependencies:
    anti-delusion: "https://example.com/system.md"  # 嵌套依赖，vasmc sync 自动扁平安装
  compile:
    format: prompt            # prompt（AI 消费）| doc（人类文档）
    targetLangs: ["zh-CN"]    # 目标交叉编译语种
  vision: |
    产物应形成严格的代码审查专家角色，专注安全漏洞检测，
    输出结构化（级别/位置/描述/建议），风格简洁。
  fix: suggest                # suggest（输出建议等待确认）| auto（直接编辑产物）
---
```

***

## 第四章：AI 专用 CLI 命令

**只使用以下零 LLM 调用命令**（禁止使用 `vasmc build`、`vasmc lint`、`vasmc diff` —— 这些会触发外部 LLM 调用，是人类专用工具）：

| 命令 | 说明 |
|------|------|
| `vasmc agent <file>` | AI 编辑器的唯一编译入口，零 LLM，输出 `.vasmc/agent-instructions.md` |
| `vasmc graph <file>` | 静态分析依赖 AST 树，排查循环依赖或缺失文件 |
| `vasmc init` | 在当前目录生成默认 `vasmc-build.yaml` 配置模板 |
| `vasmc add <url>` | 下载远程模块并注册到 `vasmc.yaml`（支持 `--alias`、`--dest`） |
| `vasmc sync` | 根据 `vasmc.yaml` 安装所有缺失依赖，生成/更新 `vasmc-lock.yaml` |
| `vasmc seal <patterns>` | 将普通 Markdown 封装为 VASM 模块（注入 Frontmatter、重命名为 `.vasm.md`） |

***

**注意事项**：

* `@import:inline` 嵌套超过 3 层会导致 LLM 注意力缺失（幻觉），建议扁平化架构。
* 远程依赖通过 Hash 锁定，内容变更需执行 `vasmc sync --update <alias>` 才生效。
* `prompt` 格式文件内部所有内联素材必须与目标编译语种一致，避免混杂多语言。
