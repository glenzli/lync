# @vasm/core

`@vasm/core` 是 VASMC 的确定性编译核心。它承载 VASM 协议解析、Frontmatter 处理、依赖图遍历、`@import` 展开、语言块过滤、工作区构建和输出合并逻辑。

这个包不包含外部模型 SDK，不读取 `llm` 配置，也不执行语义校验或自动翻译。需要人类辅助的 LLM 工具时，请使用 `@vasm/console`；需要给 AI 编辑器生成工作单时，请使用 `@vasm/cli` 的 `vasmc build`。

<a name="syntax"></a>

## 🔮 核心语法与引入协议 (Core Syntax)

### 引入语法

`[链接文本](vasm:alias "@vasm-directive")`

* **链接重写模式 (`@import:link`)**:
  编译器将 `vasm:alias` 替换为目标文件的本地相对物理路径，保留超链接结构。
  ```markdown
  请参阅下方的 [代码审查辅助技能](vasm:coder-skill "@import:link")。
  ```
  *构建输出*: `请参阅下方的 [代码审查辅助技能](./skills/coder.md)。`

* **内联展开模式 (`@import:inline`)**:
  编译器读取目标文件的纯文本内容，并直接替换该引用链接。主要用于组装大型 Prompt 上下文。
  ```markdown
  根据本组织的 [公司开发规范](vasm:company-rules "@import:inline")：
  ```
  *构建输出*: 原始链接被移除，并在原位置插入 `guidelines.md` 的完整文本内容。

### 原生多语种交叉编译 (Cross-Compilation)

VASMC 支持使用 AST 指令对 Prompt 进行原生多语言支持：

```markdown
# 通用系统规则
你是一个代码专家。

<!-- lang:en -->
Please explain the code step by step.
<!-- /lang -->

<!-- lang:zh-CN -->
请逐步解释代码。
<!-- /lang -->
```

生成时，使用 `--target-langs` 参数指定你需要生成的语言。VASMC 会自动过滤 AST 树，分别输出纯净的各语言产物。

***

<a name="publish"></a>

## 📦 发布模块 (Frontmatter 注入)

如果您通过公共 URL 分发提示词模块，强烈建议在 `.md` 文件顶部添加 YAML Frontmatter 块，声明正式别名和嵌套依赖项。

手动注入内容的示例：

```yaml
---
vasm:
  alias: "my-coder-prompt"
  version: "1.0.0"
  dependencies:
    anti-delusion: "https://example.com/system.md"
  compile:
    format: prompt        # prompt（AI 消费）| doc（人类文档）
    targetLangs: ["zh-CN"]
  kind: skill             # prompt | skill | doc | policy | fragment
  scope:
    domains: ["code-review", "security"]
    filePatterns: ["**/*.ts", "**/*.js"]
  capabilities:
    readFiles: true
    editFiles: false
    runCommands: false
    network: false
    externalModels: false
    publish: false
  activation:
    intent: ["review", "security audit"]
    priority: 80
    conflictsWith: ["general-code-reviewer"]
  trust:
    source: "github:example/coder-prompt"
    license: "MIT"
  vision: |
    产物应形成一个严格的代码审查专家角色，专注于安全漏洞检测，
    输出结构化（级别/位置/描述/建议），风格简洁，不扮演开发者。
  fix: suggest          # suggest（默认，输出建议）| auto（直接编辑产物并报告）
---

# 你的 Prompt 正文内容...
```

*当其他人通过 `vasmc add <your-url>` 安装时，VASMC 会自动解析这些内容并完美还原环境。*

> **`vision`**：声明编译产物应达到的语义目标。`vasmc build` 执行时，AI 协调器将对照此目标对产物进行意图对齐验证（语义编译的 Verify Pass）。
>
> **`fix`**：控制发现问题时的修复策略——`suggest` 仅列出建议等待用户确认，`auto` 直接修改产物文件并输出变更摘要。仅对 `prompt` 格式文件有效。
>
> **Skill 治理字段**：`kind: skill` 会启用更严格的 manifest 诊断。`scope` 描述适用领域和文件范围，`capabilities` 显式声明该 skill 预期使用的能力边界，`activation` 描述何时应被选择以及与哪些 skill 冲突，`trust` 记录供应链来源和许可证。诊断结果会写入 `.vasmc/build-report.yaml`，必要时也会进入 `.vasmc/build-instructions.md` 的 Policy Review 工作项。

### 确定性 Policy Gate

AI 侧 `vasmc build` 会为每个 entry 生成 `policy.status`：

* `pass`：未发现确定性 policy 风险。
* `review`：存在需要 AI 或人类阅读的风险信号，例如高危能力声明、过宽 activation、疑似 prompt override 语句。
* `blocked`：存在确定性阻断风险，例如 manifest 结构错误、远程依赖 hash 与 `vasmc-lock.yaml` 不一致、依赖声明了入口 skill 未声明的 capability。

默认情况下，VASMC 只报告风险，不阻断输出：

```yaml
security:
  mode: review
```

如果项目希望启用本地确定性阻断，可以在 `vasmc-build.yaml` 中切换为：

```yaml
security:
  mode: enforce
```

`enforce` 只会阻止可执行 skill 类产物被更新；普通文档仍按确定性编译流程输出。被阻断时，`.vasmc/build-report.yaml` 会记录 `status: blocked`，`.vasmc/build-instructions.md` 会生成 **Policy Gate** 工作项。
