# Lync 知识手册（AI Agent 专用）

---

## 第一章：Lync 是什么（心智模型）

**Lync 是专为 LLM Prompt 工程设计的静态编译器/链接器。**

核心类比：`.lync.md` 是人类编写的**源码**（意图/高级语言），`.md` 是编译产物（**机器码**）。两者职责严格分离——**人类禁止手工修改产物文件**；AI 协调器在 `fix: auto` 模式下可直接编辑产物，其他情况下也应以修改产物为目标，不改源文件。

编译过程是纯确定性的 AST 组装：解析 `@import` 依赖 → 展开/重写链接 → 过滤语种区块 → 剥离 Frontmatter → 输出纯净 Markdown。整个过程零 LLM 调用。

**AI 编辑器的角色**：你是智能的大脑，Lync 是确定性的肌肉。运行 `lync agent` 后，Lync 完成 AST 组装并生成 `.lync/agent-instructions.md`，你负责接管后续语义任务（校验、意图对齐验证、产物修复、翻译、Diff）。

---

## 第二章：项目结构与文件职责

```
my-project/
├── lync.yaml              # 远程依赖声明（URL → 本地 Alias 映射）
├── lync-lock.yaml         # SHA-256 Hash 锁文件（提交到版本控制）
├── lync-build.yaml        # 工作区编译配置（includes、output、routing、targetLangs）
├── .lync/                 # ⚠️ 内部缓存 + 临时产物（加入 .gitignore）
│   ├── <alias>.md         # lync sync 下载的纯缓存依赖
│   └── agent-instructions.md  # lync agent 的 AI 编排指令清单
├── src/
│   ├── persona.lync.md    # 源文件（含 Frontmatter + @import 指令）
│   └── main.lync.md       # 主入口源文件
└── dist/
    └── main.md            # 编译产物（纯净 Markdown，禁止手工修改）
```

### 两种编译格式（在 Frontmatter 的 `compile.format` 中声明）

| 格式 | 适用场景 | 多语种处理 | 典型产物 |
|------|----------|-----------|---------|
| `exec` | AI 直接消费的可执行指令 | 单语种分别输出（`main.en.md`、`main.zh-CN.md`） | System Prompt、技能文件 |
| `doc` | 供人类阅读的文档 | 多语种内容合并到同一文件 | README、HELP、DESIGN |

### `@import` 模式选择原则

- **`@import:inline`**：把目标文件完整内容嵌入当前位置。用于组装大型 Prompt。⚠️ 嵌套超过 3 层会导致 LLM 注意力缺失（幻觉），建议扁平化。
- **`@import:link`**：仅将别名重写为本地相对路径，保留超链接结构。用于文档交叉引用。

---

## 第三章：语法速查（含示例）

### @import 引入

```markdown
<!-- 通过别名引入（需在 lync.yaml 注册） -->
[技能内容](lync:my-skill "@import:inline")
[技能链接](lync:my-skill "@import:link")

<!-- 本地相对路径引入（无需注册，直接使用，天然支持热修改） -->
[人格设定](./fragments/persona.lync.md "@import:inline")
```

### 多语种编译区块

```markdown
<!-- lang:zh-CN -->
这段内容只出现在中文产物中。
<!-- /lang -->

<!-- lang:en -->
This only appears in English output.
<!-- /lang -->

这段内容未被包裹，所有语种产物都会包含它。
```

### 模块 Frontmatter 协议

```yaml
---
lync:
  alias: "my-module"          # lync add 时自动采用此字段作为本地别名
  version: "1.0.0"            # 语义版本（仅供人类参考，引擎以 Hash 为准）
  dependencies:               # 声明当前模块的远程依赖（lync sync 自动安装）
    anti-delusion: "https://example.com/system.md"
  compile:
    format: "prompt"            # exec（AI 消费）或 doc（人类文档）
    targetLangs: ["zh-CN"]    # 交叉编译目标语种
  vision: |                   # 【可选，仅 exec】声明产物应达成的语义目标
    产物应形成一个严格的代码审查专家，
    专注于安全漏洞检测，输出结构化（级别/位置/描述/建议）。
  fix: suggest                # 【可选，仅 exec】suggest（建议，默认）| auto（直接修改产物）
---
```

**`vision`**：在 `lync agent` 的 Verify Pass 中，AI 协调器将对照此目标检查产物的意图对齐程度。

**`fix`**：控制发现偏差时的处理方式——`suggest` 输出修改建议等待用户确认；`auto` 直接编辑产物文件并输出变更摘要。

---

## 第四章：AI 专用 CLI 命令

> ⚠️ **禁止使用 `lync build`、`lync lint`、`lync diff`**——这些命令调用外部 LLM API，是人类专用工具。

| 命令 | 说明 |
|------|------|
| `lync agent <file>` | **AI 唯一编译入口**，零 LLM，AST 组装后输出 `.lync/agent-instructions.md` |
| `lync graph <file>` | 静态分析依赖 AST 树，打印可视化依赖图，排查循环依赖或缺失文件 |
| `lync init` | 在当前目录生成默认 `lync-build.yaml` 配置模板，初始化工作区 |
| `lync add <url>` | 下载远程模块并注册到 `lync.yaml`（支持 `--alias`、`--dest`） |
| `lync sync` | 根据 `lync.yaml` 安装所有缺失依赖，生成/更新 `lync-lock.yaml` |
| `lync seal <patterns>` | 将普通 Markdown 封装为 Lync 模块（注入 Frontmatter、重命名为 `.lync.md`） |

### 典型工作流（新项目）

```bash
lync init                                  # 初始化工作区配置
lync add https://example.com/skill.md      # 注册远程依赖
lync sync                                  # 安装所有依赖
# 编写 *.lync.md 源文件...
lync agent main.lync.md                    # 编译 + 生成 AI 指令清单
# → 读取 .lync/agent-instructions.md，按 Action Items 顺序执行
```

### 注意事项

- 远程依赖通过 Hash 锁定；上游内容变更后需执行 `lync sync --update <alias>` 才生效。
- `exec` 格式文件的所有内联素材必须与目标语种一致，避免混杂多语言导致 LLM 注意力分散。
- `lync-lock.yaml` 应提交到版本控制；`.lync/` 目录应加入 `.gitignore`。
- 本地相对路径引用（`./` 或 `../` 开头）无需在 `lync.yaml` 注册，天然支持热修改，不做 Hash 锁定。
