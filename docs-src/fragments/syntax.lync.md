<a name="syntax"></a>
## 🔮 核心语法与引入协议 (Core Syntax)
### 引入语法

`[链接文本](lync:alias "@lync-directive")`

*   **链接重写模式 (`@import:link`)**: 
    编译器将 `lync:alias` 替换为目标文件的本地相对物理路径，保留超链接结构。
    ```markdown
    请参阅下方的 [代码审查辅助技能](lync:coder-skill "@import:link")。
    ```
    *构建输出*: `请参阅下方的 [代码审查辅助技能](./skills/coder.md)。`

*   **内联展开模式 (`@import:inline`)**:
    编译器读取目标文件的纯文本内容，并直接替换该引用链接。主要用于组装大型 Prompt 上下文。
    ```markdown
    根据本组织的 [公司开发规范](lync:company-rules "@import:inline")：
    ```
    *构建输出*: 原始链接被移除，并在原位置插入 `guidelines.md` 的完整文本内容。

### 原生多语种交叉编译 (Cross-Compilation)
Lync 支持使用 AST 指令对 Prompt 进行原生多语言支持：

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
生成时，使用 `--target-langs` 参数指定你需要生成的语言。Lync 会自动过滤 AST 树，分别输出纯净的各语言产物。

---

<a name="publish"></a>
## 📦 发布模块 (Frontmatter 注入)
如果您通过公共 URL 分发提示词模块，强烈建议在 `.md` 文件顶部添加 YAML Frontmatter 块，声明正式别名和嵌套依赖项。

手动注入内容的示例：
```yaml
---
lync:
  alias: "my-coder-prompt"
  version: "1.0.0"
  dependencies:
    anti-delusion: "https://example.com/system.md"
  compile:
    format: exec        # exec（AI 消费）| doc（人类文档）
    targetLangs: ["zh-CN"]
  vision: |
    产物应形成一个严格的代码审查专家角色，专注于安全漏洞检测，
    输出结构化（级别/位置/描述/建议），风格简洁，不扮演开发者。
  fix: suggest          # suggest（默认，输出建议）| auto（直接编辑产物并报告）
---

# 你的 Prompt 正文内容...
```
*当其他人通过 `lync add <your-url>` 安装时，Lync 会自动解析这些内容并完美还原环境。*

> **`vision`**：声明编译产物应达到的语义目标。`lync agent` 执行时，AI 协调器将对照此目标对产物进行意图对齐验证（语义编译的 Verify Pass）。
>
> **`fix`**：控制发现问题时的修复策略——`suggest` 仅列出建议等待用户确认，`auto` 直接修改产物文件并输出变更摘要。仅对 `exec` 格式文件有效。
