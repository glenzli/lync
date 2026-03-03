# VASMC - Help & Usage

[🇨🇳 中文](#zh-cn) | [🌍 English](#en)

***

<a name="zh-cn"></a>

## 🇨🇳 中文

<a name="syntax-zh-cn"></a>

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

<a name="publish-zh-cn"></a>

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
    format: prompt        # exec（AI 消费）| doc（人类文档）
    targetLangs: ["zh-CN"]
  vision: |
    产物应形成一个严格的代码审查专家角色，专注于安全漏洞检测，
    输出结构化（级别/位置/描述/建议），风格简洁，不扮演开发者。
  fix: suggest          # suggest（默认，输出建议）| auto（直接编辑产物并报告）
---

# 你的 Prompt 正文内容...
```

*当其他人通过 `vasmc add <your-url>` 安装时，VASMC 会自动解析这些内容并完美还原环境。*

> **`vision`**：声明编译产物应达到的语义目标。`vasmc agent` 执行时，AI 协调器将对照此目标对产物进行意图对齐验证（语义编译的 Verify Pass）。
>
> **`fix`**：控制发现问题时的修复策略——`suggest` 仅列出建议等待用户确认，`auto` 直接修改产物文件并输出变更摘要。仅对 `exec` 格式文件有效。

<a name="cli-human-zh-cn"></a>

## 🛠️ CLI 使用方法与编译构建

**1. 初始化项目**
你可以使用以下命令在当前目录快速生成一份默认的 `vasmc-build.yaml` 配置文件模板：

```bash
vasmc init
```

在工程根目录建立一个 `vasmc.yaml` 来声明依赖：

```yaml
dependencies:
  company-rules: "https://example.com/guidelines.md"
  coder-skill:
    url: "https://example.com/coder-skill.md"
    dest: "./skills/coder.md"
```

*或者直接使用命令行：*

```bash
vasmc add https://example.com/coder-skill.md --alias coder-skill --dest ./skills/coder.md
```

**2. 版本控制配置**
将 `.vasmc/` 加入 `.gitignore`（这是 VASMC 的内部缓存目录）。`vasmc-lock.yaml` 应提交到版本控制——它确保构建的确定性。

```gitignore
.vasmc/
```

**3. 状态收敛 (同步)**
一键安装所有缺少的依赖，并生成 `vasmc-lock.yaml`：

```bash
vasmc sync
```

**4. 执行编译（简单一对一）**
目前 VASMC 支持直接的一对一编译，将你的 `.vasm.md` 源文件及其挂载的依赖，精准输出为干净的单体 `.md` 产物供 LLM 消费（`-o` 指定输出目录）：

```bash
vasmc build main.vasm.md -o ./dist
```

**5. 语义校验 (LLM 驱动)**
编译完成后，可使用独立的 `vasmc lint` 命令对产物进行语义冲突检测：

```bash
vasmc build main.vasm.md
vasmc lint main.md --model gpt-4o
```

*需要在环境变量中配置 `OPENAI_API_KEY`，或通过 `.vasmrc` 配置自定义大模型节点。*

**6. 快捷封装 (Auto-Frontmatter)**

> 💡 **技巧：** 你可以运行以下命令，将普通的 Markdown 文件自动转换为 VASM 模块：
>
> ```bash
> vasmc seal my-prompt.md --alias my-custom-name
> ```
>
> *支持 Glob 模式批量操作：`vasmc seal "prompts/**/*.md"`*
> *这个命令会自动从文件名或路径中推断一个别名，在顶部注入 Frontmatter，并自动将文件重命名为 `.vasm.md`。*

***

<a name="workspace-zh-cn"></a>

### 🗂️ 进阶用法：工作区批量编译

对于大型项目，VASMC 支持通过 `vasmc-build.yaml` 配置文件进行自动化的批量编译。

在你的项目根目录下创建 `vasmc-build.yaml`：

```yaml
# 编译器需要扫描哪些源文件？
includes:
  - "src/**/*.vasm.md"

# 编译产物输出到哪里？
output:
  dir: "./dist"

# 剔除映射前缀目录
baseDir: "./src"

# 交叉编译目标语种（按输出格式分别配置）
compile:
  doc:                          # 文档格式：多语言合并
    targetLangs: ["en", "zh-CN"]
  exec:                         # 可执行指令格式：单语言输出
    targetLangs: ["en"]

# [高级] 路由拦截器
routing:
  - match: "src/agents/*.vasm.md"
    dest: "./dist/agents/"
```

### \[高级] 全局配置 (.vasmrc)

VASMC 现在支持在用户的全局目录 (`~/.vasmrc`) 或项目根目录 (`./.vasmrc`，**请记得将其加入 `.gitignore`**) 中创建独立的 `.vasmrc` 配置文件配置自定义大模型节点。

```yaml
lang: "zh-CN" # VASMC 的全局交互日志和大模型输出语言
llm:
  baseURL: "https://api.deepseek.com/v1"
  apiKey: "your-custom-api-key"
  model: "deepseek-chat"
```

随后，只需执行无参数补全的构建命令即可：

```bash
vasmc build
```

*同时支持 CLI 临时覆盖：*

```bash
vasmc build --out-dir ./doc --base-dir ./src
```

***

<a name="en"></a>

## 🌍 English

<a name="syntax-en"></a>

## 🔮 Core Syntax and Import Protocols (Core Syntax)

### Import Syntax

`[链接文本](vasm:alias "@vasm-directive")`

* **Link Rewrite Mode (`@import:link`)**:
  The compiler replaces `vasm:alias` with the local relative physical path of the target file, preserving the hyperlink structure.
  ```markdown
  请参阅下方的 [代码审查辅助技能](vasm:coder-skill "@import:link")。
  ```
  *Build Output*: `请参阅下方的 [代码审查辅助技能](./skills/coder.md)。`

* **Inline Expansion Mode (`@import:inline`)**:
  The compiler reads the plain text content of the target file and directly replaces the reference link. Primarily used for assembling large Prompt contexts.
  ```markdown
  根据本组织的 [公司开发规范](vasm:company-rules "@import:inline")：
  ```
  *Build Output*: The original link is removed, and the full text content of `guidelines.md` is inserted at its position.

### Native Multi-language Cross-Compilation (Cross-Compilation)

VASMC supports native multi-language support for Prompts using AST directives:

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

During generation, use the `--target-langs` parameter to specify the languages you need to generate. VASMC will automatically filter the AST tree and output clean products for each language respectively.

***

<a name="publish-en"></a>

## 📦 Publishing Modules (Frontmatter Injection)

If you distribute prompt modules via public URLs, it is strongly recommended to add a YAML Frontmatter block at the top of the `.md` file to declare formal aliases and nested dependencies.

Example of manual content injection:

```yaml
---
vasm:
  alias: "my-coder-prompt"
  version: "1.0.0"
  dependencies:
    anti-delusion: "https://example.com/system.md"
  compile:
    format: prompt        # exec（AI 消费）| doc（人类文档）
    targetLangs: ["zh-CN"]
  vision: |
    产物应形成一个严格的代码审查专家角色，专注于安全漏洞检测，
    输出结构化（级别/位置/描述/建议），风格简洁，不扮演开发者。
  fix: suggest          # suggest（默认，输出建议）| auto（直接编辑产物并报告）
---

# 你的 Prompt 正文内容...
```

*When others install via `vasmc add <your-url>`, VASMC will automatically parse these contents and perfectly restore the environment.*

> **`vision`**: Declares the semantic goal that the compiled product should achieve. When `vasmc agent` is executed, the AI orchestrator will verify the product against this goal for intent alignment (the Verify Pass of semantic compilation).
>
> **`fix`**: Controls the fix strategy when issues are found—`suggest` only lists suggestions waiting for user confirmation, while `auto` directly modifies the product files and outputs a change summary. Only valid for `exec` format files.

<a name="cli-human-en"></a>

## 🛠️ CLI Usage and Compilation/Build

**1. Initialize Project**
You can use the following command to quickly generate a default `vasmc-build.yaml` configuration template in the current directory:

```bash
vasmc init
```

Create a `vasmc.yaml` in the project root to declare dependencies:

```yaml
dependencies:
  company-rules: "https://example.com/guidelines.md"
  coder-skill:
    url: "https://example.com/coder-skill.md"
    dest: "./skills/coder.md"
```

*Or use the command line directly:*

```bash
vasmc add https://example.com/coder-skill.md --alias coder-skill --dest ./skills/coder.md
```

**2. Version Control Configuration**
Add `.vasmc/` to `.gitignore` (this is VASMC's internal cache directory). `vasmc-lock.yaml` should be committed to version control—it ensures build determinism.

```gitignore
.vasmc/
```

**3. State Convergence (Sync)**
Install all missing dependencies with one click and generate `vasmc-lock.yaml`:

```bash
vasmc sync
```

**4. Execute Compilation (Simple One-to-One)**
Currently, VASMC supports direct one-to-one compilation, outputting your `.vasm.md` source files and their mounted dependencies precisely as clean, monolithic `.md` artifacts for LLM consumption (`-o` specifies the output directory):

```bash
vasmc build main.vasm.md -o ./dist
```

**5. Semantic Linting (LLM-Driven)**
After compilation, you can use the standalone `vasmc lint` command to perform semantic conflict detection on the artifacts:

```bash
vasmc build main.vasm.md
vasmc lint main.md --model gpt-4o
```

*You need to configure `OPENAI_API_KEY` in your environment variables, or configure a custom LLM node via `.vasmrc`.*

**6. Quick Sealing (Auto-Frontmatter)**

> 💡 **Tip:** You can run the following command to automatically convert regular Markdown files into VASM modules:
>
> ```bash
> vasmc seal my-prompt.md --alias my-custom-name
> ```
>
> *Supports Glob pattern batch operations: `vasmc seal "prompts/**/*.md"`*
> *This command will automatically infer an alias from the filename or path, inject Frontmatter at the top, and automatically rename the file to `.vasm.md`.*

***

<a name="workspace-en"></a>

### 🗂️ Advanced Usage: Workspace Batch Compilation

For large projects, VASMC supports automated batch compilation via the `vasmc-build.yaml` configuration file.

Create `vasmc-build.yaml` in your project root:

```yaml
# Which source files should the compiler scan?
includes:
  - "src/**/*.vasm.md"

# Where should the build artifacts be output?
output:
  dir: "./dist"

# Strip mapping prefix directory
baseDir: "./src"

# Cross-compilation target languages (configured per output format)
compile:
  doc:                          # Document format: Multi-language merge
    targetLangs: ["en", "zh-CN"]
  exec:                         # Executable instruction format: Single-language output
    targetLangs: ["en"]

# [Advanced] Routing Interceptors
routing:
  - match: "src/agents/*.vasm.md"
    dest: "./dist/agents/"
```

### \[Advanced] Global Configuration (.vasmrc)

VASMC now supports creating a standalone `.vasmrc` configuration file in the user's global directory (`~/.vasmrc`) or the project root (`./.vasmrc`, **please remember to add it to `.gitignore`**) to configure custom LLM nodes.

```yaml
lang: "en" # Global interaction logs and LLM output language for VASMC
llm:
  baseURL: "https://api.deepseek.com/v1"
  apiKey: "your-custom-api-key"
  model: "deepseek-chat"
```

Then, simply execute the build command without parameters:

```bash
vasmc build
```

*Also supports CLI temporary overrides:*

```bash
vasmc build --out-dir ./doc --base-dir ./src
```
