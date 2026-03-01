# Lync - Help & Usage

🌍 [English](#english) | 🇨🇳 [中文](#chinese)

---

<a name="english"></a>
## 🌍 English

### 🚀 Quick Start & CLI Usage

**1. Initialization**
You can quickly scaffold a default `lync-build.yaml` in your project root:
```bash
lync init
```

Create a `lync.yaml` file in your project root to declare your dependencies:

```yaml
dependencies:
  company-rules: "https://example.com/guidelines.md"
  coder-skill:
    url: "https://example.com/coder-skill.md"
    dest: "./skills/coder.md"
```

*Alternatively, use the CLI:*
```bash
lync add https://example.com/coder-skill.md --alias coder-skill --dest ./skills/coder.md
```

**2. Version Control Setup**
Add `.lync/` to your `.gitignore` (this is the internal cache directory). The `lync-lock.yaml` should be committed—it ensures deterministic builds.
```gitignore
.lync/
```

**3. Synchronization**
Install the declared packages and generate the `lync-lock.yaml`:
```bash
lync sync
```

**4. Usage inside your Markdown**
```markdown
# My Awesome Prompt

## 1. Remote Native Dependency (lync protocol)
According to the [Company Development Guidelines](lync:company-rules "@import:inline"):
(The compiler will replace this link with the raw text)

## 2. Local Relative Imports
You can also import local files directly using relative paths, bypassing `lync.yaml`:
[My Local Persona](./prompts/persona.lync.md "@import:inline")
```

**5. Compilation (Simple One-to-One)**
Currently, Lync supports straightforward one-to-one compilation from your `.lync.md` mapped to an output `.md` file:
```bash
lync build main.lync.md -o main.md
```

**6. Native Semantic Linting (LLM-Powered)**
Ensure your assembled prompt is free of logic conflicts, persona inconsistencies, and system destruction risks:
```bash
lync build main.lync.md -o main.md --verify --lang en
```
*Requires `OPENAI_API_KEY` in your environment. You can optionally specify a model with `--model gpt-4o`, or CLI/Verify output language with `--lang`. Non-critical issues (like redundancy) will only show warnings without blocking the build.*

**7. Publishing a Module (Frontmatter)**
If you are distributing your prompt module via a public URL, it's highly recommended to add a YAML Frontmatter block at the top of your `.md` file to declare your official alias and any nested dependencies. 

> 💡 **Tip:** You can automatically convert any standard Markdown file into a Lync module by running:
> ```bash
> lync seal my-prompt.md --alias my-custom-name
> ```
> *Supports Glob wildcards for batch operation: `lync seal "prompts/**/*.md"`*
> *This will intelligently infer the alias from the file path (ignoring generic names like `index`), inject the required frontmatter, and rename the file to `my-prompt.lync.md`. You can also force a specific name using `--alias`.*

Manual example of the injected block:
```yaml
---
lync:
  alias: "my-coder-prompt"
  version: "1.0.0"
  dependencies:
    anti-delusion: "https://example.com/system.md"
---

# Your Prompt Content here...
```
*When others use `lync add <your-url>`, Lync will automatically parse this and set up their local environment precisely as you intended.*

**8. Multilingual Compilation & LLM Fallback (i18n)**
Lync supports native Internationalization for prompts using AST directives. You can author multiple language blocks within the same `.lync.md` file:

```markdown
# Universal System Rules
You are an expert coder.

:::lang{lang="en"}
Please explain the code step by step.
:::

:::lang{lang="zh-CN"}
请逐步解释代码。
:::
```

When building, use `--target-langs` to specify the desired output languages:
```bash
lync build my-prompt.lync.md --target-langs en,zh-CN
```
Lync will filter the AST, producing `my-prompt.en.md` and `my-prompt.zh-CN.md`.
**Magic LLM Fallback:** If a target language is requested (e.g., `ja`) but missing from the source, Lync will automatically call the LLM (`OPENAI_API_KEY` required) to translate the best available block into the target language and inject it seamlessly into the AST!

### 🗂️ Advanced: Workspace Compilation

For larger projects, Lync supports automated batch compilation using a `lync-build.yaml` configuration. This allows you to construct complex routing rules using Glob patterns.

Create a `lync-build.yaml` in your workspace root:

```yaml
# Which files should the compiler scan?
includes:
  - "src/**/*.lync.md"

# Where should compiled files go?
output:
  dir: "./dist"
  # flat: true    # Ignore baseDir hierarchy, output everything directly into dir
  # inPlace: true  # Compile output alongside the source file (ignores dir)

# Strip this prefix directory from the original paths
baseDir: "./src"

# Target languages (optional, defaults to auto-detection from source)
# targetLangs:
#   - "en"
#   - "zh-CN"

# Advanced Routing Interceptors
routing:
  - match: "src/agents/*.lync.md"
  dest: "./dist/agents/"
```

### Global Configuration (.lyncrc)
Create a `.lyncrc` file in your home directory (`~/.lyncrc`) or project root (`./.lyncrc`, **remember to add it to `.gitignore`**) to securely configure custom LLMs for validation and translation, and to set your global workspace language.
```yaml
lang: "en" # Global language for CLI output and LLM verification (en, zh-CN)
llm:
  baseURL: "https://api.deepseek.com/v1"
  apiKey: "optional-custom-api-key"
  model: "deepseek-chat"
```

Then, simply execute the parameterless build command:
```bash
lync build
```

*CLI Ad-hoc overrides are also supported:*
```bash
lync build --out-dir ./doc --base-dir ./src
```


---

<a name="chinese"></a>
## 🇨🇳 中文

### 🚀 快速上手与 CLI 用法

**1. 初始化项目**
你可以使用以下命令在当前目录快速生成一份默认的 `lync-build.yaml` 配置文件模板：
```bash
lync init
```

在工程根目录建立一个 `lync.yaml` 来声明依赖：

```yaml
dependencies:
  company-rules: "https://example.com/guidelines.md"
  coder-skill:
    url: "https://example.com/coder-skill.md"
    dest: "./skills/coder.md"
```

*或者直接使用命令行：*
```bash
lync add https://example.com/coder-skill.md --alias coder-skill --dest ./skills/coder.md
```

**2. 版本控制配置**
将 `.lync/` 加入 `.gitignore`（这是 Lync 的内部缓存目录）。`lync-lock.yaml` 应提交到版本控制——它确保构建的确定性。
```gitignore
.lync/
```

**3. 状态收敛 (同步)**
一键安装所有缺少的依赖，并生成 `lync-lock.yaml`：
```bash
lync sync
```

**4. Markdown 语法调用**
直接在你的 `.lync.md` 文件里使用 `lync:{alias}` 协议：
```markdown
# 我的核心 Prompt

根据 [公司开发规范](lync:company-rules "@import:inline")：
(原始链接被移除，并在原位置插入完整文本内容)
```

**5. 执行编译（简单一对一）**
目前 Lync 支持直接的一对一编译，将你的 `.lync.md` 源文件及其挂载的依赖，精准输出为干净的单体 `.md` 产物供 LLM 消费：
```bash
lync build main.lync.md -o main.md
```

**6. 原生语义检查 (LLM 驱动)**
在编译完成后自动启动大模型，静态检查组装后的 Prompt 是否存在指令冲突、角色分裂或系统破坏风险：
```bash
lync build main.lync.md -o main.md --verify --lang zh-CN
```
*需要在环境变量中配置 `OPENAI_API_KEY`。可以通过 `--model gpt-4o` 指定模型，或通过 `--lang` 指定 CLI 和大模型输出的语言。非致命问题（如逻辑冗余）将只显示警告而不会阻断编译。*

**7. 发布模块 (Frontmatter 注入)**
如果您通过公共 URL 分发提示词模块，强烈建议在 `.md` 文件顶部添加 YAML Frontmatter 块，声明正式别名和嵌套依赖项。

> 💡 **技巧：** 你可以运行以下命令，将普通的 Markdown 文件自动转换为 Lync 模块：
> ```bash
> lync seal my-prompt.md --alias my-custom-name
> ```
> *支持 Glob 模式批量操作：`lync seal "prompts/**/*.md"`*
> *这个命令会自动从文件名或路径中推断一个别名，在顶部注入 Frontmatter，并自动将文件重命名为 `.lync.md`。可以通过 `--alias` 覆写具体名称。*

手动注入内容的示例：
```yaml
---
lync:
  alias: "my-coder-prompt"
  version: "1.0.0"
  dependencies:
    anti-delusion: "https://example.com/system.md"
---

# 你的 Prompt 正文内容...
```
*当其他人通过 `lync add <your-url>` 安装时，Lync 会自动解析这些内容并完美还原环境。*

**8. 原生多语种编译与回译补全 (i18n)**
Lync 支持使用 AST 指令对 Prompt 进行原生多语言支持：

```markdown
# 通用系统规则
你是一个代码专家。

:::lang{lang="en"}
Please explain the code step by step.
:::

:::lang{lang="zh-CN"}
请逐步解释代码。
:::
```

生成时，使用 `--target-langs` 参数指定你需要生成的语言：
```bash
lync build my-prompt.lync.md --target-langs en,zh-CN
```
Lync 会自动过滤 AST 树，分别输出 `my-prompt.en.md` 和 `my-prompt.zh-CN.md` 两个产物。
**魔法回译兜底**：如果在构建时请求了目标语言（如 `ja` 日本语），但源代码中缺失，Lync （在配置 `OPENAI_API_KEY` 时）将会调用大语言模型，自动将最匹配的语言块动态翻译为目标语言并无缝织入 AST！

### 🗂️ 进阶用法：工作区批量编译

对于大型项目，Lync 支持通过 `lync-build.yaml` 配置文件进行自动化的批量编译。这允许你使用 Glob 模式构建复杂的路由和分发规则。

在你的项目根目录下创建 `lync-build.yaml`：

```yaml
# 编译器需要扫描哪些源文件？
includes:
  - "src/**/*.lync.md"

# 编译产物输出到哪里？
output:
  dir: "./dist"
  # flat: true    # 开启后忽略 baseDir 层级，所有文件直接输出到 dir
  # inPlace: true  # 开启后忽略 dir，直接在源文件旁边原地生成产物

# 剔除映射前缀目录
baseDir: "./src"

# 目标生成语言（可选，默认从源文件自动探测）
# targetLangs:
#   - "en"
#   - "zh-CN"

# [高级] 路由拦截器
routing:
  - match: "src/agents/*.lync.md"
  dest: "./dist/agents/"
```

### [高级] 全局配置 (.lyncrc)
Lync 现在支持在用户的全局目录 (`~/.lyncrc`) 或项目根目录 (`./.lyncrc`，**请记得将其加入 `.gitignore`**) 中创建独立的 `.lyncrc` 配置文件。
您可以用来配置全局交互/验证语言，以及避免您的 API Key 泄露到版本控制中：
```yaml
lang: "zh-CN" # Lync 的全局交互日志和大模型输出语言
llm:
  baseURL: "https://api.deepseek.com/v1"
  apiKey: "your-custom-api-key"
  model: "deepseek-chat"
```

随后，只需执行无参数补全的构建命令即可：
```bash
lync build
```

*同时支持 CLI 临时覆盖：*
```bash
lync build --out-dir ./doc --base-dir ./src
```
