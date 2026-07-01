<a name="syntax"></a>
## 🔮 核心语法与引入协议 (Core Syntax)
### 引入语法

`[链接文本](vasm:alias "@vasm-directive")`

*   **链接重写模式 (`@import:link`)**: 
    编译器将 `vasm:alias` 替换为目标文件的本地相对物理路径，保留超链接结构。
    ```markdown
    请参阅下方的 [代码审查辅助技能](vasm:coder-skill "@import:link")。
    ```
    *构建输出*: `请参阅下方的 [代码审查辅助技能](./skills/coder.md)。`

*   **内联展开模式 (`@import:inline`)**:
    编译器读取目标文件的纯文本内容，并直接替换该引用链接。主要用于组装大型 Prompt 上下文。
    ```markdown
    根据本组织的 [公司开发规范](vasm:company-rules "@import:inline")：
    ```
    *构建输出*: 原始链接被移除，并在原位置插入 `guidelines.md` 的完整文本内容。

### 多语种输出 (Cross-Compilation)
VASMC 支持用语言块为 Prompt 声明不同语种内容：

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

---

<a name="publish"></a>
## 📦 发布模块 (Frontmatter 注入)
如果您通过公共 URL 分发提示词模块，强烈建议在 `.md` 文件顶部添加 YAML Frontmatter 块，声明正式别名和嵌套依赖项。

手动注入内容的示例：
```yaml
---
vasm:
  alias: "my-coder-prompt"
  version: "1.0.0"
  intent: "Assemble a concise code-review prompt focused on security findings."
  dependencies:
    anti-delusion: "https://example.com/system.md"
  compile:
    format: executable    # informational | executable | integrative
    targetLangs: ["zh-CN"]
---

# 你的 Prompt 正文内容...
```
*当其他人通过 `vasmc add <your-url>` 安装时，VASMC 会解析这些内容并还原依赖配置。*

> **`intent`**：声明源文件希望产物达成的用途。`vasmc build` 不调用模型执行它，只把它写入 AI report actions，供当前 AI 做 Verify 或 Integration Review。
>
> **`compile.format`**：
> * `informational`：纯信息/文档产物，多个目标语种会合并为一个 Markdown 文件。
> * `executable`：作为 AI 指令读取的 prompt/skill 产物，多语种时每种语言输出独立文件。
> * `integrative`：用于指导一组 VASM 模块如何组合；它不是最终可执行 prompt，AI 应在组合时参考它。
>
> 为了平滑迁移，`doc` 会映射为 `informational`，`prompt` 会映射为 `executable`，并输出 deprecated 诊断；其他值是非法格式。

### 确定性 Policy Gate

AI 侧 `vasmc build` 会为每个 entry 生成 `policy.status`：

* `pass`：未发现确定性 policy 风险。
* `review`：存在需要 AI 或人类阅读的风险信号，例如疑似 prompt override、隐藏行为、密钥外传、integrative/executable 边界不清。
* `blocked`：存在确定性阻断风险，例如 manifest 结构错误、远程依赖 hash 与 `vasmc-lock.yaml` 不一致、`informational` 产物导入了 `executable` 或 `integrative` 内容。

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

`enforce` 会阻止 `executable` 和 `integrative` 产物在 blocked 状态下被更新；`informational` 文档仍按确定性编译流程输出并记录报告。被阻断时，`.vasmc/build-report.yaml` 会记录 `status: blocked`，并在对应 entry 的 `actions` 中写入 `policy_gate`。

### Project Review Pass

VASMC 可以在编译完成后生成一个项目上下文索引，让当前 AI 结合仓库内容审查编译产物是否贴合项目，而不是只做语法编译：

```yaml
ai:
  projectReview:
    mode: suggest      # off | suggest | patch
    include:
      - "README.md"
      - "docs/**/*.md"
      - "package.json"
      - "vasmc-build.yaml"
      - "skill-src/**/*.vasm.md"
```

开启后，`vasmc build` 会生成 `.vasmc/project-review-context.yaml`，并在 `.vasmc/build-report.yaml` 顶层 `actions` 中写入 `project_review`。该 pass 不调用模型，也不自动改文件；它只告诉当前 AI 应读取哪些项目文件，并要求 AI 输出源文件级建议。`patch` 模式表示可以给出聚焦的源文件 patch 建议，但仍不得直接编辑生成物。
