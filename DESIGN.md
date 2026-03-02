# Lync 协议与跨平台编译器规范

## 核心设计哲学：Prompt 汇编化 (Prompt as LLM Assembly)

> *该理念受 [Vibe Coding Framework](https://github.com/glenzli/vibe-coding-framework/blob/main/PRINCIPLES.md) 的深刻启发。*

在传统的思维中，Prompt 被视为“既要写给人看，又要写给机器看”的自然语言文本。Lync 彻底打破了这种妥协，确立了以下大模型基础设施的核心工程共识：

1. **意图即源码，Prompt 即编译产物**：在 AI-Native 架构中，系统级的指令（如 System-Prompt、固化的 SKILL 流程说明）应当被严格视为用于驱动底层模型的“汇编语言（Assembly / Machine Code）”。人类开发者的“自然语言意图”和抽象拓扑结构（通过 `lync:alias` 组合）才是真正的 Source Code（源码）。
2. **拒绝手工字句微调 (No Manual Prompt Tweaking)**：人类不应当，也不需要直接在文本级手工雕琢已被验证的高维 Prompt。Prompt 的唯一评价标准是“能否稳定触发底层模型的正确动作”。这种模块化组装应该交给像 Lync 这样的静态链接器，系统严禁基于“玄学”的手工微调。
3. **闭环编译体系 (Agentic Compilation Workflow)**：对系统 Prompt 的功能性修改必须借由 LLM 自主生成、执行、验证、修正的闭环完成。Lync 的 `lync agent` 命令正是这一流程的物理载体，将 Lync 提升为了客观的“编译器前端”，由外部 Agent 读取 AST 指令后接管编译的后半段过程（优化、剪裁与翻译）。
4. **多语种交叉编译 (Cross-Compilation Targets)**：当 Prompt 被视为机器码，它的具体语种就不再是传统意义上的"国际化（i18n）"，而是指定"CPU 架构"（各模型对不同语系的解析性能不同）。Lync 支持使用母语编写意图源文件（高级语言），然后利用 LLM 交叉编译出纯正目标语种的高效 Prompt 机器指令，从而消灭了在同一份大文件中杂糅双语对照而导致的 Token 浪费与幻觉问题。

Lync 是一个专为 LLM 相关开发流设计的轻量级、去中心化 Markdown 包管理器与 **跨平台编译器**。它将 Markdown 视为高级工程抽象代码，提供依赖管理、内联组合和确定性构建机制，且不依赖任何中心化注册表。

***

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

* **本地唯一标识**：在项目中，别名（如 `company-rules`）是主键。若声明重复的别名，解析器将直接覆盖或抛出错误。
* 通过将目标 URL 与本地 Alias 解耦，Lync 规避了全局命名冲突问题。

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

***

## Part 2: 代码引入 (Import)

依赖安装后，可在源文件（如 `.lync.md`）中通过 `lync:{alias}` 协议协议进行引用。

Lync 采用向下兼容的设计原则：将编译指令编码为标准 Markdown 链接的 Title 属性，以确保未编译的源文件在通用阅读器中保持可读。

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

***

## Part 3: Lync 编译器核心与 CLI 概览

Lync 编译器（CLI 工具）是负责兑现协议的执行引擎。

### 1. 锁文件 (`lync-lock.yaml`)

如果说 `lync.yaml` 是给人写的，那么 `lync-lock.yaml` 就是纯粹由机器生成和阅读的。它记录了本地 Alias 与确切 URL、dest 路径以及最终解析到的 SHA-256 Hash（或 Frontmatter 版本号）的映射关系。这保证了在任何机器上执行同步都是 100% 幂等和确定的。

### 2. CLI 命令架构

Lync CLI 采用严格的关注点分离原则，将命令分为三类：

**确定性工具（零 LLM 调用）**：

* `lync build [file]`：纯确定性编译器。执行 AST 遍历、`@import` 解析、交叉编译翻译。翻译是编译器核心能力（相当于 gcc 的交叉编译后端），不属于"增强功能"。注意：LLM 翻译后端仅在人类直接调用时生效；AI 编辑器应使用 `lync agent` 以绕过所有 LLM 调用。
* `lync graph <file>`：静态分析 AST 并打印依赖关系的可视化 ASCII 树。
* `lync seal <patterns>`：将普通 Markdown 封装为 Lync 模块（注入 Frontmatter、语言标签）。
* `lync sync`、`lync add`、`lync init`：依赖管理与项目初始化。

**LLM 增强工具（独立子命令，按需调用）**：

* `lync lint <file>`：对已编译产物执行 LLM 驱动的语义冲突检测。完全独立于编译流程，就像 `clippy` 独立于 `rustc`。
* `lync diff <file>`：对新旧编译产物执行 LLM 驱动的语义对比分析。

**Agent 专用工具**：

* `lync agent <file>`：为 AI 编辑器设计的编译前端。执行纯确定性的 AST 组装（零 LLM 调用），输出 `.lync/agent-instructions.md` 编排操作令，由外部 AI 编辑器接管后续的语义剪裁、冲突裁决与翻译。

> 👉 **完整指南**：关于 Lync 命令行的详细使用方法、全局 `.lyncrc` 配置、大模型接入指南等文档，请参阅 [**Lync 帮助文档 (HELP.md)**](HELP.md)。

***

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

* **alias**：强烈建议填写。当其他用户执行 `lync add <你的链接>` 时，Lync 会优先使用此字段作为其命名空间中的映射别名。
* **version**：供人类评估兼容性使用的元数据（Lync 引擎锁定版本时仅以内容 Hash 为唯一真理）。
* **dependencies**：声明当前模块运行**不可或缺的远程依赖**。当用户拉取你的模块时，Lync 的 `sync` 引擎会自动读取这些嵌套依赖，并将其扁平化地一并安装到他们的工作区中（遵循“主权覆写”防冲突原则）。

### 3. 扁平化命名与语义冲突解决 (Flat Resolution & Semantic Linting)

对于必须引入的嵌套依赖，Lync 采用全局扁平的 Alias 命名空间，不允许多版本嵌套（像 npm 那样）。
当主项目和子依赖需要同一个模块时，Lync 不会像传统包管理器那样对组件进行暴力的“命名空间硬覆盖替换”。因为自然语言构成的 Prompt 强行替换往往会导致上下文断裂和逻辑失控。
遇到逻辑或定义分歧时，Lync 将问题交由 **LLM Linter** 处理。编译完成后执行 `lync lint <file>`，让大模型来判断不同模块拼装在一起后是否存在无法调和的冲突，再由开发者根据报告进行针对性的重构。

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

***

## Part 5: 技能飞轮与自举 (Skill Flywheel & Self-Bootstrapping)

Lync 不仅是编译器，它还通过自身的编译能力来维护和更新自己的技能知识库。这形成了一个闭环的自举飞轮（Flywheel）。

### 1. 飞轮架构

以 Lync 自身附带的 `lync-expert` 技能为例，其工程拓扑如下：

```
skill-src/lync-expert/                       # 工程源码目录
├── lync-expert.lync.md                     # 主入口（高级语言源码）
│   ├── @import:inline lync-knowledge.md    #   ← AI 知识手册
│   └── @import:inline agent-coordinator    #   ← Agent 协调规程
├── lync-knowledge.md                       # 知识手册（由 LLM 蒸馏生成）
├── agent-coordinator.lync.md              # lync agent 模式操作手册
└── extract-lync-knowledge.lync.md         # 提取流水线 Prompt（生成知识手册的指令）

skills/lync-expert/                         # 编译产物目录（纯净）
└── lync-expert.md                          # 唯一的可执行文件（静态链接体）
```

### 2. 飞轮循环

当 Lync 的设计文档或 CLI 发生变更时，飞轮自动运转：

```
  ┌──────────────────────────────────────────────────────┐
  │  DESIGN.lync.md / HELP.lync.md 发生变更              │
  │          ↓ lync build (编译文档)                      │
  │  DESIGN.md / HELP.md (最新编译产物)                   │
  │          ↓ extract-lync-knowledge.lync.md            │
  │          ↓ (展开后作为 Prompt 喂给 AI 编辑器)          │
  │  AI 编辑器输出新的 lync-knowledge.md (知识手册蒸馏)    │
  │          ↓ 覆写 skill-src/.../lync-knowledge.md      │
  │          ↓ lync build (重编译技能)                    │
  │  skills/lync-expert/lync-expert.md (更新后的机器码)   │
  └──────────────────────────────────────────────────────┘
```

### 3. 设计原则

* **自包含（Static Linking）**：最终产出的技能文件必须是一个自包含的闭包。AI 编辑器只需加载 `lync-expert.md` 这一个文件，即可同时获得语法速查、CLI 参考和 `lync agent` 模式操作规程。不允许出现运行时的外部依赖——"加载即可用，零断链"。
* **知识蒸馏分离**：`lync-knowledge.md` 是由 AI 编辑器根据 `extract-lync-knowledge.lync.md` 的指令从源文档中蒸馏出来的 AI 专用知识手册。它不是手写的，而是随时可以通过重新执行提取流水线来再生的中间产物。
* **流水线即 Prompt**：`extract-lync-knowledge.lync.md` 本身就是一个 Lync 源文件，它通过 `@import:inline` 拉入最新的编译文档作为上下文，指导 AI 编辑器生成新的知识手册。这意味着**提取流水线本身也是由 Lync 管理的模块化代码**。
* **语种一致性**：技能文件（`exec` 格式）内部的所有内联素材必须与目标编译语种保持一致，避免在单一可执行体中混杂多种语言而导致 LLM 注意力分散。

***

## Part 6: 安全性保证

* **严格防范循环依赖 (Strict DAG Enforcement)**: 在执行 `lync build` 时，如果被引入的文件又递归引入了其他文件，编译器必须维护调用栈。一旦检测到闭环（`A -> B -> C -> A`），必须立即报致命错误。
* **本地写入冲突防范**: 执行 `sync` 之前，Lync 必须做静态预检。如果在 `lync.yaml` 中发现两个不同的 Alias 被赋予了完全一样的 `dest` 写入路径，必须立即抛出致命冲突错误。
* **未知别名拦截**: 如果 `build` 过程中遇到了未在清单中注册的 `lync:unknown-alias`，编译器应立即终止，并提示开发者先去 `lync.yaml` 中安装该依赖。
