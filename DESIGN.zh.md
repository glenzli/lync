# Lync 协议与编译器规范

考虑到 Markdown 已经成为大语言模型 (LLM) 时代实际意义上的逻辑控制语言（例如用于编写 Prompt、System Instruction 等），Markdown 在特定工作流中已具备源代码的属性。

Lync 是一个专为 LLM 相关开发流设计的轻量级、去中心化 Markdown 包管理器与编译器。它将 Markdown 视为工程代码，提供依赖管理、内联组合和确定性构建机制，且不依赖任何中心化注册表。

---

## Part 1: 包管理清单 (Install)

Lync 使用清单文件声明远程依赖，然后再在源文件中引用。这避免了硬编码 URL，有利于版本控制，并能在本地建立统一的模块别名（Alias）。

### 1. 清单文件 (`lync.yaml`)

`lync.yaml` 位于项目根目录。其核心作用是将远程 URL 映射到本地唯一的别名上。

```yaml
dependencies:
  # 场景 A：纯缓存依赖。仅下载到内部缓存，工作区不可见。
  # 适用于将被用作内联展开 (Inline) 的纯文本片段。
  company-rules: "https://example.com/guidelines.md"
  
  # 场景 B: 显式物理落盘。下载到本地指定的物理路径。
  # 适用于构建本地知识库或技能库目录。
  coder-skill:
    url: "https://example.com/coder-skill.md"
    dest: "./skills/coder.md"
```

### 2. 别名生成与冲突处理机制

Lync 要求开发者保证别名在项目 `lync.yaml` 中的唯一性。
*   **本地唯一标识**：在项目中，别名（如 `company-rules`）是主键。若声明重复的别名，解析器将直接覆盖或抛出错误。
*   通过将目标 URL 与本地 Alias 解耦，Lync 规避了全局命名冲突问题。

若开发者手动编辑 `lync.yaml`，则使用声明的键作为别名。
若通过 CLI 工具 `lync add <url>` 安装依赖，系统按以下优先级生成别名：
1. **显式指定**: 命令行参数 `--alias`（如 `lync add https://.../foo.md --alias bar`）具有最高优先级。
2. **文件名推导**: 缺省情况下，提取 URL 的末尾路径并移除扩展名作为别名（如 `.../my-skill.md` 推导为 `my-skill`）。
3. **后缀递增冲突避免**: 若推导得到的别名在 `lync.yaml` 中已存在，则自动追加数字后缀（如 `my-skill-1`）以防止配置覆盖。开发者后续可手动修改该名称。

### 3. 本地缓存目录与版本控制

当依赖声明中 **未指定 `dest`** 时，`lync sync` 会将文件下载到项目根目录下的 **`.lync/`** 隐藏目录中（例如 `.lync/company-rules.md`）。该目录为纯内部缓存，应通过 `.gitignore` 排除：

```gitignore
# Lync 内部缓存（由 lync sync 自动管理）
.lync/
```

> **注意**：`lync-lock.yaml` 应 **提交到版本控制**。它类似于 `package-lock.json`，是确定性构建的保证——团队成员执行 `lync sync` 时将依据此文件还原完全一致的依赖状态。

---

## Part 2: 代码引入 (Import)

依赖安装后，可在源文件（如 `.lync.md`）中通过 `lync:{alias}` 协议协议进行引用。

Lync 采用向下兼容的设计原则：将编译指令编码为标准 Markdown 链接的 Title 属性，以确保未编译的源文件在通用阅读器中保持可读。

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

---

## Part 3: Lync 编译器核心 (CLI 工具)

Lync 编译器（CLI 工具）是负责兑现上述协议的执行引擎。

### 1. 锁文件 (`lync-lock.yaml`)

如果说 `lync.yaml` 是给人写的，那么 `lync-lock.yaml` 就是纯粹由机器生成和阅读的。它记录了本地 Alias 与确切 URL、dest 路径以及最终解析到的 SHA-256 Hash（或 Frontmatter 版本号）的映射关系。这保证了在任何机器上执行同步都是 100% 幂等和确定的。

**格式示例：**
```yaml
version: 1
dependencies:
  coder-skill:
    url: "https://example.com/coder-skill.md"
    dest: "./skills/coder.md"
    version: "1.2.0"
    hash: "e3b0c442..."
    fetchedAt: "2026-02-26T20:50:36Z"
```

### 2. 核心 CLI 交互指令详解

*   `lync add <url> [options]`:
    一键式依赖添加与安装指令。
    *   **行为**：探测目标 URL 并将其依赖关系保存进 `lync.yaml` 中，随后执行同步下载并建立 Lock。如果携带 `--dest <path>` 参数，则会指定特定的物理落盘位置。
    *   **智能别名推断 (Smart Alias Inference)**：为了防止 `prompt.md` 等无意义的重名污染，Lync 在执行 `add` 时会自动按以下优先级推断组件别名：
        1. **Frontmatter 声明优先**：主动拉取远端文件的头部元数据，寻找作者官方声明的 `lync.alias` 字段。
        2. **智能路径回溯**：若未声明，且 URL 末尾属于典型的通用工程词汇（如 `main`, `index`, `prompt`, `src`, `heads` 等及其变体），Lync 将自动沿着 URL 路径倒序向上回溯，直至提取出真正具备辨识度的父级目录名（例如 `.../anti-delusion/prompt.zh-CN.md` 会被精准提取为 `anti-delusion`）。
        3. 若发生别名碰撞，则通过自增后缀跳过覆盖（如 `anti-delusion-1`）。开发者永远可以通过 `--alias <name>` 参数一键手动覆盖上述所有推断逻辑。
*   `lync sync`:
    （默认指令，等同于 `lync install`）根据声明强行收敛状态的指令。
    *   **行为**：读取 `lync.yaml` 和 `lync-lock.yaml`。对于新增依赖或缺少本地文件的依赖，去远端拉取。如果 URL 已经在于 Lock 文件中，则优先使用本地锁定状态，保证构建行为确定性。
*   `lync update [alias]`:
    强制打破锁定状态更新库缓存的指令。
    *   **行为**：无视本地缓存和 Lock 文件的拦截，强制就某一 alias 或所有的 alias 去远端发送最新的网络请求，拿到最新内容后重新计算 Hash 并覆写到 `lync-lock.yaml`。
*   `lync seal <file>`:
    （Module Initialization）将普通 Markdown 封装为 Lync 模块的快捷指令。
    *   **行为**：读取目标文件并在顶部自动注入 YAML Frontmatter (声明 `alias` 与 `version`)。它会复用 `lync add` 的启发式目录推断逻辑来智能命名（或根据 `--alias` 强行指定），最后修改文件后缀为 `.lync.md`。
*   `lync build [entry]`:
    核心编译与展开指令。支持单个文件或目录级的批量编译：
    *   `lync build main.lync.md -o main.md`
    *   `lync build --out-dir ./dist --base-dir ./src`
    *   **行为**：扫描入口并进行 AST 解析，拦截所有匹配的 `lync:alias` 自定义链接。将 `@import:inline` 指令内联展开，将 `@import:link` 降级重写。支持局部传入 `--out-dir` 和 `--base-dir` 批量构建树状结构，更推荐不加参数默认执行基于 `lync-build.yaml` 配置的批量构建路由。

### 3. 编译配置文件 (Workspace Build Configuration)

对于包含多个文件的项目，特别是需要将输出产物分布到特定 Agent IDE 目录（如 Cursor、Windsurf 或 Cline 等）的工作流，Lync 提供全局构建路由能力。

由于 `lync.yaml` 往往被 `lync add` 命令自动修改和管理，而构建规则高度定制化且需要人类长期维护，因此 Lync 推荐将构建设定抽离为一个独立的配置文件：**`lync-build.yaml`**。

```yaml
# lync-build.yaml

# 搜集源文件的 Glob 模式
includes:
  - "src/**/*.lync.md"

# 默认降级回写的总输出目录
outDir: "./dist"

# 映射基准目录（会将包含文件的路径原封不动平移时，剔除该前缀）
baseDir: "./src"

# 输出路由干预 (Routing rules)
routing:
  # 场景 A：如果源文件或目标产物名字带有 .skill.md，自动写入 IDE 默认技能槽
  - match: "*.skill.md"
    dest: "./.agents/skills/"
  # 场景 B：针对单一主控入口，编译完成后强制覆盖 IDE 的全局 System 隐藏文件
  - match: "main.lync.md"
    dest: "./.cursorrules" 
```

一旦项目根目录存在此配置，直接执行指令：
`lync build` （不携带任何参数）

此时编译器会读取 `lync-build.yaml`，遍历匹配的源文件，展开包含网络，并根据 `routing` 规则输出最终的纯文本 Markdown 到对应的物理目录，以完成批量编译与组件分发。

### 4. 基于 LLM 的语义检查 (Semantic Linting)

由于 Lync 组装的是大语言模型的 Prompt，传统的包管理器无法检测自然语言级别的逻辑冲突。

在执行 `lync build` 时携带 `--verify` 标志，Lync 会在编译完成后调用 LLM 进行静态分析（需配置 `OPENAI_API_KEY`，可通过 `--model` 指定模型）。主要检查：
*   **指令冲突 (Instruction Conflict)**：不同组件引入了自相矛盾的格式或行为要求。
*   **设定一致性 (Persona Consistency)**：上下文中的人设或语气是否存在分裂。
*   **安全风险 (Security Risk)**：第三方模块中是否包含 Prompt Injection（提示词注入攻击）。
*   **逻辑冗余 (Redundancy)**：概念是否被多次重复定义以节省 Token。

### 5. 基于 AST 的多语种原生支持 (i18n) 与 LLM 动态回译

在编写高质量复杂 Prompt 时，受众通常会有多语种的分发诉求，然而简单的流水线全篇机器翻译往往会破坏 Prompt 精密的代码块或特殊的语法标记（甚至破坏我们 Lync 的 \`[Link](lync:...)\` ）。
为此，Lync 在编译器层面**原生支持了 Markdown i18n 语块标记结合 LLM 的动态回流技术。**

Lync 允许作者在同一个 \`.lync.md\` 文件内，使用标准的 Markdown 块指令（Container Directives）圈定特定的语言区块：

```markdown
# 基础框架
You are an expert coder.

:::lang{lang="zh-CN"}
请详细解释这些代码。
:::

:::lang{lang="en"}
Please explain the code step by step.
:::
```

在编译分发环节，消费者可以通过 `lync-build.yaml`（`targetLangs: ["zh-CN"]`）或者命令行局部参数（`--target-langs zh-CN,ja`）来指定消费者需要的终端语种：
- Lync 编译器将会遍历整棵 AST（抽象语法树），智能修剪掉所有与 `targetLangs` 不匹配的 `:::lang{}` 语块节点。
- **动态 LLM 回译**：当消费者索要的语言（例如 `--target-langs ja`）在原始模块里并未提供时，Lync 会自动阻断常规降级流程，智能捕捉并隔离原文中结构最完整的母语语言块，在后台请求 OpenAI API 将该区块“自然语言部分”精准回译为日文，然后**直接挂载到正在编译的 AST 中**以补齐信息差。
- **旧模块兼容**：如果通篇不含有多语种语块标记的传统模块，一旦触发了特定的 `target-langs`，Lync 会启动全局层面的模块翻译。

这使得 Prompt 工程师在未来只需维护一颗 `main.lync.md` 源码树，即可高效分发给全球所有语种的 Agent。

---

## Part 4: 版本管理与依赖解析机制

如果依赖的 URL 来自于 Gist 或纯文本托管，通常没有明确的版本号，且内容可能随时被修改。针对这种去中心化的分发方式，Lync 采用以下机制：

### 1. 推荐分发编译产物 (Compiled Release)

为了避免大模型在执行时遇到矛盾指令，Lync **不推荐**深度嵌套和分发动态依赖。
如果模块 B 依赖模块 C，推荐 B 的作者先使用 `lync build` 将其编译为纯静态的 Markdown 文件（即所有内联依赖已展开的内容）后再对外发布。
带有 `lync:xxx` 标签的源码文件 (`*.lync.md`) 更适合在项目内部使用，由 `lync.yaml` 统一管理版本。

### 2. 组件声明元数据 (Lync Frontmatter Protocol)

Lync 鼓励模块作者在源文件头部使用 YAML Frontmatter 声明官方别名、版本信息以及自身的远程依赖。这不仅有助于人类开发者理解，也是 `lync add` 智能解析优先级最高的信息源。

> **最佳实践（扩展名与脱水机制）**：
> 强烈建议作为 Lync 模块分发的源文件使用 **`.lync.md`** 作为扩展名。
> 这是一个重要的界限：包含 YAML Frontmatter 和 `@import` 的文件是给“人与 Lync 编译器”看的工程源文件。当终端用户执行 `lync build` 时，编译器会自动执行**去元数据化（脱水）**，将所有的 YAML Frontmatter 静默剥离。最终产出的 `.md` 文件将是绝对纯净的自然语言，确保不会对大模型的注意力产生任何噪音干扰。

```yaml
---
lync:
  alias: "my-coder-prompt"
  version: "1.0.0"
  dependencies:
    anti-delusion: "https://example.com/system.md"
---

# 你的 Prompt 正文...
```

*   **alias**：强烈建议填写。当其他用户执行 `lync add <你的链接>` 时，Lync 会优先使用此字段作为其命名空间中的映射别名。
*   **version**：供人类评估兼容性使用的元数据（Lync 引擎锁定版本时仅以内容 Hash 为唯一真理）。
*   **dependencies**：声明当前模块运行**不可或缺的远程依赖**。当用户拉取你的模块时，Lync 的 `sync` 引擎会自动读取这些嵌套依赖，并将其扁平化地一并安装到他们的工作区中（遵循“主权覆写”防冲突原则）。

### 3. 扁平化命名与语义冲突解决 (Flat Resolution & Semantic Linting)

对于必须引入的嵌套依赖，Lync 采用全局扁平的 Alias 命名空间，不允许多版本嵌套（像 npm 那样）。
当主项目和子依赖需要同一个模块时，Lync 不会像传统包管理器那样对组件进行暴力的“命名空间硬覆盖替换”。因为自然语言构成的 Prompt 强行替换往往会导致上下文断裂和逻辑失控。
遇到逻辑或定义分歧时，Lync 将问题交由 **LLM Linter** 处理。在编译完成后执行 `--verify`，让大模型来判断不同模块拼装在一起后是否存在无法调和的冲突，再由开发者根据报告进行针对性的重构。

### 4. 基于 Hash 的本地锁定 (Hash-Based Locking)

首次执行 `lync sync` 时，Lync 会计算下载内容的 SHA-256 Hash 并记录在 `lync-lock.yaml` 中。
后续编译将以本地缓存为准。即使上游的 URL 内容发生了变化，只要本地缓存未被清理且未执行 `lync update <alias>`，编译器会始终使用确定的本地数据块，避免远程文件的静默更改破坏构建一致性。

> **关于版本号的定位**：在传统的包管理器中，版本号（Version）决定了代码的分发解析。但在 Lync 的底层执行逻辑中，**Hash 才是唯一的真理**。虽然我们仍然推荐模块作者在 Markdown 的 Frontmatter 中添加 `version` 字段，以便于开发者进行语义理解和人工评估兼容性，但 Lync 核心执行引擎对依赖变更的感知始终仅依赖纯粹的内容 Hash。

### 5. 本地相对路径引用 (Local Relative Imports)

当您的 Prompt 模块拆分在同一个本地项目中时，强制使用 `lync.yaml` 声明配置是不必要的。
在项目内部，您可以直接利用原生 Markdown 的相对路径进行引入：

```markdown
# My System Prompt
[引入本地身份设定](./prompts/persona.lync.md "@import:inline")
[引入远程防呆模块](lync:anti-delusion "@import:inline")
```

编译器会自动识别以 `./` 或 `../` 开头的链接。它不仅能让您在主流编辑器中点按跳转到源文件，而且**本地相对引用的文件不会被强制执行 Hash Lock 计算**，天然支持本地实时联调与热修改。

---

## Part 5: 安全性保证

*   **严格防范循环依赖 (Strict DAG Enforcement)**: 在执行 `lync build` 时，如果被引入的文件又递归引入了其他文件，编译器必须维护调用栈。一旦检测到闭环（`A -> B -> C -> A`），必须立即报致命错误。
*   **本地写入冲突防范**: 执行 `sync` 之前，Lync 必须做静态预检。如果在 `lync.yaml` 中发现两个不同的 Alias 被赋予了完全一样的 `dest` 写入路径，必须立即抛出致命冲突错误。
*   **未知别名拦截**: 如果 `build` 过程中遇到了未在清单中注册的 `lync:unknown-alias`，编译器应立即终止，并提示开发者先去 `lync.yaml` 中安装该依赖。
