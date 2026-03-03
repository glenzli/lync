# Lync - Help & Usage

<a name="syntax"></a>

## 🔮 核心语法与引入协议 (Core Syntax)

### 引入语法

`[链接文本](lync:alias "@lync-directive")`

* **链接重写模式 (`@import:link`)**:
  编译器将 `lync:alias` 替换为目标文件的本地相对物理路径，保留超链接结构。
  ```markdown
  请参阅下方的 [代码审查辅助技能](lync:coder-skill "@import:link")。
  ```
  *构建输出*: `请参阅下方的 [代码审查辅助技能](./skills/coder.md)。`

* **内联展开模式 (`@import:inline`)**:
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

***

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
    format: prompt        # exec（AI 消费）| doc（人类文档）
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

<a name="cli-human"></a>

## 🛠️ CLI 使用方法与编译构建

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

**4. 执行编译（简单一对一）**
目前 Lync 支持直接的一对一编译，将你的 `.lync.md` 源文件及其挂载的依赖，精准输出为干净的单体 `.md` 产物供 LLM 消费（`-o` 指定输出目录）：

```bash
lync build main.lync.md -o ./dist
```

**5. 语义校验 (LLM 驱动)**
编译完成后，可使用独立的 `lync lint` 命令对产物进行语义冲突检测：

```bash
lync build main.lync.md
lync lint main.md --model gpt-4o
```

*需要在环境变量中配置 `OPENAI_API_KEY`，或通过 `.lyncrc` 配置自定义大模型节点。*

**6. 快捷封装 (Auto-Frontmatter)**

> 💡 **技巧：** 你可以运行以下命令，将普通的 Markdown 文件自动转换为 Lync 模块：
>
> ```bash
> lync seal my-prompt.md --alias my-custom-name
> ```
>
> *支持 Glob 模式批量操作：`lync seal "prompts/**/*.md"`*
> *这个命令会自动从文件名或路径中推断一个别名，在顶部注入 Frontmatter，并自动将文件重命名为 `.lync.md`。*

***

<a name="workspace"></a>

### 🗂️ 进阶用法：工作区批量编译

对于大型项目，Lync 支持通过 `lync-build.yaml` 配置文件进行自动化的批量编译。

在你的项目根目录下创建 `lync-build.yaml`：

```yaml
# 编译器需要扫描哪些源文件？
includes:
  - "src/**/*.lync.md"

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
  - match: "src/agents/*.lync.md"
    dest: "./dist/agents/"
```

### \[高级] 全局配置 (.lyncrc)

Lync 现在支持在用户的全局目录 (`~/.lyncrc`) 或项目根目录 (`./.lyncrc`，**请记得将其加入 `.gitignore`**) 中创建独立的 `.lyncrc` 配置文件配置自定义大模型节点。

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
