# VASMC - Help & Usage

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

<a name="cli"></a>

## 🛠️ @vasm/cli：AI 编译与工作单

`@vasm/cli` 提供 `vasmc` 命令，是 VASMC 的 AI-facing 编译入口。它只做确定性工作：依赖同步、AST 组装、语言块过滤、产物写入，以及生成给当前 AI 使用的后续工作单。

### 安装

```bash
npm install -g @vasm/cli
```

### 1. 初始化项目

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

也可以直接使用命令行注册依赖：

```bash
vasmc add https://example.com/coder-skill.md --alias coder-skill --dest ./skills/coder.md
```

### 2. 同步与锁定

将 `.vasmc/` 加入 `.gitignore`。这是 VASMC 的内部缓存目录。`vasmc-lock.yaml` 应提交到版本控制，它确保构建输入确定。

```gitignore
.vasmc/
```

安装所有缺失依赖并生成或更新锁文件：

```bash
vasmc sync
```

需要强制刷新时：

```bash
vasmc update <alias>
vasmc update
```

### 3. AI 编译

一对一编译并生成工作单：

```bash
vasmc build main.vasm.md -o ./dist
```

工作区编译并生成工作单：

```bash
vasmc build
```

`vasmc build` 是 AI 侧唯一编译入口。它会执行确定性的 AST 组装、语言块过滤和产物写入；如果目标语言缺失，它不会调用外部模型自动补全，而是在 `.vasmc/build-instructions.md` 中生成后续工作单，让当前 AI 接管 Verify、Translate、Diff 和 Tree-Shake 等语义任务。

### 4. 工作单

```bash
cat .vasmc/build-instructions.md
```

每次执行 `vasmc build` 后，AI 编辑器都应立即读取 `.vasmc/build-instructions.md`，并按其中列出的 Action Items 顺序执行。

### 5. 其他确定性命令

```bash
vasmc graph main.vasm.md
vasmc seal my-prompt.md --alias my-custom-name
vasmc seal "prompts/**/*.md" --format prompt
```

`seal` 会为普通 Markdown 注入 VASM Frontmatter，并将文件重命名为 `.vasm.md`。对于 README、HELP、DESIGN 等人类文档，请显式使用 `--format doc`；对于 System Prompt、Skill 等 AI 消费文件，请使用 `--format prompt`。

***

<a name="workspace"></a>

### 🗂️ 工作区批量编译

```yaml
includes:
  - "src/**/*.vasm.md"

output:
  dir: "./dist"

baseDir: "./src"

compile:
  doc:
    targetLangs: ["zh-CN"]
  prompt:
    targetLangs: ["zh-CN"]

routing:
  - match: "src/agents/*.vasm.md"
    dest: "./dist/agents/"
```

也支持 CLI 临时覆盖：

```bash
vasmc build --out-dir ./doc --base-dir ./src
```

<a name="cli-ai-build"></a>

## 🤖 AI Build 工作流

大模型辅助编程时代，VASMC 只负责确定性组装；语义校验、翻译、Diff 和裁剪应由当前 AI 接管。作为统管全局的 AI 助手，你应该使用 AI 侧 build 驱动编译：

```bash
vasmc build [file]
```

> **AI 编辑器始终使用 `vasmc build`。**\
> 在 `@vasm/cli` 中，`build` 会同时产出确定性 Markdown 和 `.vasmc/build-instructions.md` 后续工作单。

在该模式下，VASMC 执行 AST 静态组装，并在项目隐藏目录输出指令清单：

**`.vasmc/build-instructions.md`**

### AI 助手操作规程

每当你执行了 `vasmc build` 命令后，**立即读取 `.vasmc/build-instructions.md`**，并按其中列出的 Action Items 顺序执行以下任务（具体步骤由编译器按需生成）：

1. **Semantic Verify**：读取 Minimal-Token Variant，检查语义冲突、人格分裂、逻辑冗余和系统破坏风险四类问题。
2. **Translation**（按需）：若 instructions 中包含此步骤，将已校验的核心文件翻译到指定的其他语种，**严格保留** Markdown AST 结构。
3. **Semantic Diff**（按需）：若 instructions 中包含此步骤，读取指定的历史备份文件，向用户说明本次编译在底层结构上影响了什么。
4. **Tree-Shake（条件性）**：**仅在**用户明确表达了优化 Prompt 的意图时，才执行裁剪分析。

你是统筹全局的智能主体，而 VASMC 是你最可靠的确权肌肉。

<a name="console"></a>

## 🧭 @vasm/console：人用控制台与可选外部模型工具

`@vasm/console` 提供 `vasm-console` 命令，面向人类开发者使用。它复用确定性编译能力，但额外提供需要外部模型的语义辅助命令。

### 安装

```bash
npm install -g @vasm/console
```

### 语义校验

编译完成后，可以对产物执行 LLM 驱动的语义冲突检测：

```bash
vasmc build main.vasm.md
vasm-console lint main.md --model gpt-4o
```

`lint` 会检查四类问题：指令冲突、人格分裂、逻辑冗余和系统破坏风险。它不属于确定性编译链，失败时不会改变源文件或产物文件。

### 语义 Diff

```bash
vasm-console diff new.md old.md --model gpt-4o
```

`diff` 会解释两个编译产物之间的语义和结构影响，而不是只报告文本差异。

### 外部模型配置

`vasm-console` 可以通过环境变量或 `.vasmrc` 配置 OpenAI-compatible 节点。`.vasmrc` 可以放在用户目录或项目根目录；项目内 `.vasmrc` 应加入 `.gitignore`。

```yaml
lang: "zh-CN"
llm:
  baseURL: "https://api.deepseek.com/v1"
  apiKey: "your-custom-api-key"
  model: "deepseek-chat"
```

等价环境变量：

```bash
VASM_LLM_API_KEY=...
VASM_LLM_BASE_URL=...
VASM_LLM_MODEL=...
```

`lang` 也会影响 VASMC 的交互日志语言；`llm` 只被 `@vasm/console` 的外部模型工具读取。
