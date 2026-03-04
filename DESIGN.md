# VASM 协议与 VASMC 跨平台编译器规范

[🇨🇳 中文](#zh-cn) | [🌍 English](#en)

***

<a name="zh-cn"></a>

## 🇨🇳 中文

## 核心设计哲学：Prompt 汇编化 (Prompt as LLM Assembly)

> *该理念受 [Vibe Coding Framework](https://github.com/glenzli/vibe-coding-framework/blob/main/PRINCIPLES.md) 的深刻启发。*

在传统的思维中，Prompt 被视为“既要写给人看，又要写给机器看”的自然语言文本。VASMC 彻底打破了这种妥协，确立了以下大模型基础设施的核心工程共识：

1. **意图即源码，Prompt 即编译产物**：在 AI-Native 架构中，系统级的指令（如 System-Prompt、固化的 SKILL 流程说明）应当被严格视为用于驱动底层模型的“汇编语言（Assembly / Machine Code）”。人类开发者的“自然语言意图”和抽象拓扑结构（通过 `vasm:alias` 组合）才是真正的 Source Code（源码）。
2. **拒绝手工字句微调 (No Manual Prompt Tweaking)**：人类不应当，也不需要直接在文本级手工雕琢已被验证的高维 Prompt。Prompt 的唯一评价标准是“能否稳定触发底层模型的正确动作”。这种模块化组装应该交给像 VASMC 这样的静态链接器，系统严禁基于“玄学”的手工微调。
3. **闭环编译体系 (Agentic Compilation Workflow)**：对系统 Prompt 的功能性修改必须借由 LLM 自主生成、执行、验证、修正的闭环完成。VASMC 的 `vasmc agent` 命令正是这一流程的物理载体，将 VASMC 提升为了客观的“编译器前端”，由外部 Agent 读取 AST 指令后接管编译的后半段过程（优化、剪裁与翻译）。
4. **多语种交叉编译 (Cross-Compilation Targets)**：当 Prompt 被视为机器码，它的具体语种就不再是传统意义上的"国际化（i18n）"，而是指定"CPU 架构"（各模型对不同语系的解析性能不同）。VASMC 支持使用母语编写意图源文件（高级语言），然后利用 LLM 交叉编译出纯正目标语种的高效 Prompt 机器指令，从而消灭了在同一份大文件中杂糅双语对照而导致的 Token 浪费与幻觉问题。
5. **语义编译与意图规约 (Semantic Compilation via Vision)**：真正的编译器不只做结构变换，还要保证语义正确性。VASMC 允许开发者在源文件 Frontmatter 中声明 `vision`（产物应达成的语义目标），并通过 `fix: suggest | auto` 控制修复策略。在 `vasmc agent` 的 Verify Pass 中，AI 协调器将对照 vision 检查编译产物的意图对齐程度——`suggest` 模式输出修改建议等待确认，`auto` 模式直接编辑产物文件并报告变更摘要。这将 VASMC 从"结构链接器"升格为"语义编译器"。
6. **输入面主权 (Input Sovereignty)**：在 AI-Native 系统中，上下文窗口既是执行空间也是数据空间——LLM 在架构层面无法区分"应当执行的指令"与"应当处理的数据"，整个输入面即执行面。VASMC 是这一架构约束下**在输入层建立的唯一确定性控制点**：所有进入执行面的内容都必须经过编译链的显式声明与组装，来源可追溯，格式有分类（`prompt` 与 `doc` 的区分是编译期的安全分类原语），内容不可被隐式污染。VASMC 不试图修复 LLM 的执行层，而是在执行面形成之前，将人类的主权意志确定性地写入其中。

VASMC 是一个专为 LLM 相关开发流设计的轻量级、去中心化 Markdown 包管理器与 **跨平台编译器**。它将 Markdown 视为高级工程抽象代码，提供依赖管理、内联组合、确定性构建和输入面主权保障机制，且不依赖任何中心化注册表。

***

## Part 1: 包管理清单 (Install)

VASMC 使用清单文件声明远程依赖，然后再在源文件中引用。这避免了硬编码 URL，有利于版本控制，并能在本地建立统一的模块别名（Alias）。

### 1. 清单文件 (`vasmc.yaml`)

`vasmc.yaml` 位于项目根目录。其核心作用是将远程 URL 映射到本地唯一的别名上。

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

VASMC 要求开发者保证别名在项目 `vasmc.yaml` 中的唯一性。

* **本地唯一标识**：在项目中，别名（如 `company-rules`）是主键。若声明重复的别名，解析器将直接覆盖或抛出错误。
* 通过将目标 URL 与本地 Alias 解耦，VASMC 规避了全局命名冲突问题。

若开发者手动编辑 `vasmc.yaml`，则使用声明的键作为别名。
若通过 CLI 工具 `vasmc add <url>` 安装依赖，系统按以下优先级生成别名：

1. **显式指定**: 命令行参数 `--alias`（如 `vasmc add https://.../foo.md --alias bar`）具有最高优先级。
2. **文件名推导**: 缺省情况下，提取 URL 的末尾路径并移除扩展名作为别名（如 `.../my-skill.md` 推导为 `my-skill`）。
3. **后缀递增冲突避免**: 若推导得到的别名在 `vasmc.yaml` 中已存在，则自动追加数字后缀（如 `my-skill-1`）以防止配置覆盖。开发者后续可手动修改该名称。

### 3. 本地缓存目录与版本控制

当依赖声明中 **未指定 `dest`** 时，`vasmc sync` 会将文件下载到项目根目录下的 **`.vasmc/`** 隐藏目录中（例如 `.vasmc/company-rules.md`）。该目录为纯内部缓存，应通过 `.gitignore` 排除：

```gitignore
# VASMC 内部缓存（由 vasmc sync 自动管理）
.vasmc/
```

> **注意**：`vasmc-lock.yaml` 应 **提交到版本控制**。它类似于 `package-lock.json`，是确定性构建的保证——团队成员执行 `vasmc sync` 时将依据此文件还原完全一致的依赖状态。

***

## Part 2: 代码引入 (Import)

依赖安装后，可在源文件（如 `.vasm.md`）中通过 `vasm:{alias}` 协议进行引用。

VASM 采用向下兼容的设计原则：将编译指令编码为标准 Markdown 链接的 Title 属性，以确保未编译的源文件在通用阅读器中保持可读。

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

***

## Part 3: VASMC 编译器核心与 CLI 概览

VASMC 编译器（CLI 工具）是负责兑现协议的执行引擎。

### 1. 锁文件 (`vasmc-lock.yaml`)

如果说 `vasmc.yaml` 是给人写的，那么 `vasmc-lock.yaml` 就是纯粹由机器生成和阅读的。它记录了本地 Alias 与确切 URL、dest 路径以及最终解析到的 SHA-256 Hash（或 Frontmatter 版本号）的映射关系。这保证了在任何机器上执行同步都是 100% 幂等和确定的。

### 2. CLI 命令架构

VASMC CLI 采用严格的关注点分离原则，将命令分为三类：

**确定性工具（零 LLM 调用）**：

* `vasmc build [file]`：纯确定性编译器。执行 AST 遍历、`@import` 解析、交叉编译翻译。翻译是编译器核心能力（相当于 gcc 的交叉编译后端），不属于"增强功能"。注意：LLM 翻译后端仅在人类直接调用时生效；AI 编辑器应使用 `vasmc agent` 以绕过所有 LLM 调用。
* `vasmc graph <file>`：静态分析 AST 并打印依赖关系的可视化 ASCII 树。
* `vasmc seal <patterns>`：将普通 Markdown 封装为 VASM 模块（注入 Frontmatter、语言标签）。
* `vasmc sync`、`vasmc add`、`vasmc init`：依赖管理与项目初始化。

**LLM 增强工具（独立子命令，按需调用）**：

* `vasmc lint <file>`：对已编译产物执行 LLM 驱动的语义冲突检测。完全独立于编译流程，就像 `clippy` 独立于 `rustc`。
* `vasmc diff <file>`：对新旧编译产物执行 LLM 驱动的语义对比分析。

**Agent 专用工具**：

* `vasmc agent <file>`：为 AI 编辑器设计的编译前端。执行纯确定性的 AST 组装（零 LLM 调用），输出 `.vasmc/agent-instructions.md` 编排操作令，由外部 AI 编辑器接管后续的语义剪裁、冲突裁决与翻译。

> 👉 **完整指南**：关于 VASMC 命令行的详细使用方法、全局 `.vasmrc` 配置、大模型接入指南等文档，请参阅 [**VASMC 帮助文档 (HELP.md)**](HELP.md)。

***

## Part 4: 版本管理与依赖解析机制

如果依赖的 URL 来自于 Gist 或纯文本托管，通常没有明确的版本号，且内容可能随时被修改。针对这种去中心化的分发方式，VASMC 采用以下机制：

### 1. 推荐分发编译产物 (Compiled Release)

为了避免大模型在执行时遇到矛盾指令，VASMC **不推荐**深度嵌套和分发动态依赖。
如果模块 B 依赖模块 C，推荐 B 的作者先使用 `vasmc build` 将其编译为纯静态的 Markdown 文件（即所有内联依赖已展开的内容）后再对外发布。
带有 `vasm:xxx` 标签的源码文件 (`*.vasm.md`) 更适合在项目内部使用，由 `vasmc.yaml` 统一管理版本。

### 2. 组件声明元数据 (VASM Frontmatter Protocol)

VASMC 鼓励模块作者在源文件头部使用 YAML Frontmatter 声明官方别名、版本信息以及自身的远程依赖。这不仅有助于人类开发者理解，也是 `vasmc add` 智能解析优先级最高的信息源。

> **最佳实践（扩展名与脱水机制）**：
> 强烈建议作为 VASM 模块分发的源文件使用 **`.vasm.md`** 作为扩展名。
> 这是一个重要的界限：包含 YAML Frontmatter 和 `@import` 的文件是给“人与 VASMC 编译器”看的工程源文件。当终端用户执行 `vasmc build` 时，编译器会自动执行**去元数据化（脱水）**，将所有的 YAML Frontmatter 静默剥离。最终产出的 `.md` 文件将是绝对纯净的自然语言，确保不会对大模型的注意力产生任何噪音干扰。

```yaml
---
vasm:
  alias: "my-coder-prompt"
  version: "1.0.0"
  dependencies:
    anti-delusion: "https://example.com/system.md"
---

# 你的 Prompt 正文...
```

* **alias**：强烈建议填写。当其他用户执行 `vasmc add <你的链接>` 时，VASMC 会优先使用此字段作为其命名空间中的映射别名。
* **version**：供人类评估兼容性使用的元数据（VASMC 引擎锁定版本时仅以内容 Hash 为唯一真理）。
* **dependencies**：声明当前模块运行**不可或缺的远程依赖**。当用户拉取你的模块时，VASMC 的 `sync` 引擎会自动读取这些嵌套依赖，并将其扁平化地一并安装到他们的工作区中（遵循“主权覆写”防冲突原则）。

### 3. 扁平化命名与语义冲突解决 (Flat Resolution & Semantic Linting)

对于必须引入的嵌套依赖，VASMC 采用全局扁平的 Alias 命名空间，不允许多版本嵌套（像 npm 那样）。
当主项目和子依赖需要同一个模块时，VASMC 不会像传统包管理器那样对组件进行暴力的“命名空间硬覆盖替换”。因为自然语言构成的 Prompt 强行替换往往会导致上下文断裂和逻辑失控。
遇到逻辑或定义分歧时，VASMC 将问题交由 **LLM Linter** 处理。编译完成后执行 `vasmc lint <file>`，让大模型来判断不同模块拼装在一起后是否存在无法调和的冲突，再由开发者根据报告进行针对性的重构。

### 4. 基于 Hash 的本地锁定 (Hash-Based Locking)

首次执行 `vasmc sync` 时，VASMC 会计算下载内容的 SHA-256 Hash 并记录在 `vasmc-lock.yaml` 中。
后续编译将以本地缓存为准。即使上游的 URL 内容发生了变化，只要本地缓存未被清理且未执行 `vasmc update <alias>`，编译器会始终使用确定的本地数据块，避免远程文件的静默更改破坏构建一致性。

> **关于版本号的定位**：在传统的包管理器中，版本号（Version）决定了代码的分发解析。但在 VASMC 的底层执行逻辑中，**Hash 才是唯一的真理**。虽然我们仍然推荐模块作者在 Markdown 的 Frontmatter 中添加 `version` 字段，以便于开发者进行语义理解和人工评估兼容性，但 VASMC 核心执行引擎对依赖变更的感知始终仅依赖纯粹的内容 Hash。

### 5. 本地相对路径引用 (Local Relative Imports)

当您的 Prompt 模块拆分在同一个本地项目中时，强制使用 `vasmc.yaml` 声明配置是不必要的。
在项目内部，您可以直接利用原生 Markdown 的相对路径进行引入：

```markdown
# My System Prompt
[引入本地身份设定](./prompts/persona.vasm.md "@import:inline")
[引入远程防呆模块](vasm:anti-delusion "@import:inline")
```

编译器会自动识别以 `./` 或 `../` 开头的链接。它不仅能让您在主流编辑器中点按跳转到源文件，而且**本地相对引用的文件不会被强制执行 Hash Lock 计算**，天然支持本地实时联调与热修改。

***

## Part 5: 技能飞轮与自举 (Skill Flywheel & Self-Bootstrapping)

VASMC 不仅是编译器，它还通过自身的编译能力来维护和更新自己的技能知识库。这形成了一个闭环的自举飞轮（Flywheel）。

### 1. 飞轮架构

以 VASMC 自身附带的 `vasm-expert` 技能为例，其工程拓扑如下：

```
skill-src/vasm-expert/                       # 工程源码目录
├── vasm-expert.vasm.md                     # 主入口（高级语言源码）
│   ├── @import:inline vasmc-knowledge.md    #   ← AI 知识手册
│   └── @import:inline agent-coordinator    #   ← Agent 协调规程
├── vasmc-knowledge.md                       # 知识手册（由 LLM 蒸馏生成）
├── agent-coordinator.vasm.md              # vasmc agent 模式操作手册
└── extract-vasmc-knowledge.vasm.md         # 提取流水线 Prompt（生成知识手册的指令）

skills/vasm-expert/                         # 编译产物目录（纯净）
└── vasm-expert.md                          # 唯一的可执行文件（静态链接体）
```

### 2. 飞轮循环

当 VASMC 的设计文档或 CLI 发生变更时，飞轮自动运转：

```
  ┌──────────────────────────────────────────────────────┐
  │  DESIGN.vasm.md / HELP.vasm.md 发生变更              │
  │          ↓ vasmc build (编译文档)                      │
  │  DESIGN.md / HELP.md (最新编译产物)                   │
  │          ↓ extract-vasmc-knowledge.vasm.md            │
  │          ↓ (展开后作为 Prompt 喂给 AI 编辑器)          │
  │  AI 编辑器输出新的 vasmc-knowledge.md (知识手册蒸馏)    │
  │          ↓ 覆写 skill-src/.../vasmc-knowledge.md      │
  │          ↓ vasmc build (重编译技能)                    │
  │  skills/vasm-expert/vasm-expert.md (更新后的机器码)   │
  └──────────────────────────────────────────────────────┘
```

### 3. 设计原则

* **自包含（Static Linking）**：最终产出的技能文件必须是一个自包含的闭包。AI 编辑器只需加载 `vasm-expert.md` 这一个文件，即可同时获得语法速查、CLI 参考和 `vasmc agent` 模式操作规程。不允许出现运行时的外部依赖——"加载即可用，零断链"。
* **知识蒸馏分离**：`vasmc-knowledge.md` 是由 AI 编辑器根据 `extract-vasmc-knowledge.vasm.md` 的指令从源文档中蒸馏出来的 AI 专用知识手册。它不是手写的，而是随时可以通过重新执行提取流水线来再生的中间产物。
* **流水线即 Prompt**：`extract-vasmc-knowledge.vasm.md` 本身就是一个 VASM 源文件，它通过 `@import:inline` 拉入最新的编译文档作为上下文，指导 AI 编辑器生成新的知识手册。这意味着**提取流水线本身也是由 VASMC 管理的模块化代码**。
* **语种一致性**：技能文件（`exec` 格式）内部的所有内联素材必须与目标编译语种保持一致，避免在单一可执行体中混杂多种语言而导致 LLM 注意力分散。

***

## Part 6: AI-Native 输入面安全模型 (Input Sovereignty)

### 1. 问题根源：数据即指令

在冯诺伊曼架构中，安全工程的核心命题是保障**代码与数据的严格隔离**——指令在代码段，数据在数据段，越界即越权。这一前提在 AI-Native 系统中**根本不成立**。

由于 RLHF 的训练目标是让模型成为顺从的响应者，大模型在架构层面**无法区分「应当执行的指令」与「应当处理的数据」**。进入上下文窗口的所有 token 在注意力机制眼中是平权的。更准确的描述是：

> **AI-Native 系统天然以 `root` 权限运行——整个上下文窗口既是执行空间也是数据空间，LLM 是作用于全域输入的全局 `eval()`，且被训练为尽可能顺从执行。**

传统安全工程等待攻击者"穿透边界"；AI-Native 中根本没有边界可被穿透，因为模型从不拒绝执行输入中的任何指令。安全性从设计上就不能依赖模型自身的辨别能力。

### 2. VASMC 的应对：编译期输入主权

VASMC 不试图修复 LLM 执行层（这是不可能的），而是在**执行面形成之前**建立确定性的控制点。

**三个安全原语**：

* **来源可审计（Provenance）**：所有进入执行面的内容，必须经过 `.vasm.md` 源文件 → 编译链 → `.md` 产物的显式路径。外部内容只能通过 `vasmc add` + `vasmc sync` 的显式声明进入构建链，不存在隐式引入。进入上下文的每一个 token 都有可追溯的人类授权来源。

* **格式分类即安全分类（Format Classification）**：`compile.format: prompt | doc` 的区分远不只是"编译行为不同"——它是人类在构建期对内容用途的**主权声明**：

  * `prompt`：声明为进入 LLM 执行面的指令内容
  * `doc`：声明为供人类阅读的信息内容，**不应出现在 system prompt 中**

  在冯诺伊曼架构中，代码段与数据段由 CPU 硬件强制隔离。LLM 做不到这件事——VASMC 把这个隔离提前到**编译期**，由人类显式声明，而非期待模型运行时辨别。

* **内容确定性（Determinism）**：编译是纯确定性的 AST 组装，产物内容完全可预期、可审计、可复现。攻击者无法在构建过程中静默注入未授权内容。

### 3. VASMC 的边界

VASMC 的信任边界是**控制路径（controlled input path）**——即通过编译链进入 system prompt 的内容。它不能防御：

* 用户动态输入中的 prompt injection
* 工具调用返回值中的恶意内容
* RAG 检索内容中的注入

这些属于**运行时防御**的范畴，需要其他机制处理。VASMC 解决的是：**你能控制的那部分输入——system prompt 与 skill 文件——是否真的只包含你授权的内容**。

### 4. 编译时静态安全保证

* **严格防范循环依赖 (Strict DAG Enforcement)**：`vasmc build` 维护调用栈，一旦检测到闭环（`A → B → C → A`），立即报致命错误，防止依赖图被恶意构造为无限展开。
* **写入冲突防范**：`sync` 前做静态预检，同一 `dest` 路径被多个 Alias 声明时，立即抛出致命冲突错误。
* **未知别名拦截**：编译过程中遇到未在清单中注册的 `vasm:unknown-alias`，立即终止，不允许未经授权的依赖静默解析。

***

## Part 7: 增量构建 (Incremental Build)

VASMC 支持基于内容 Hash 的增量构建，对用户完全透明——命令不变，构建自动加速。

### 工作原理

每次成功编译后，VASMC 将所有源文件（入口文件 + 所有传递依赖）的内容 SHA-256 签名写入 `vasmc-build-state.yaml`：

```yaml
version: 1
entries:
  "docs-src/DESIGN.vasm.md|merged":
    inputSignature: "abc123..."
    outputFile: DESIGN.md
    targetLang: zh-CN
```

下次执行 `vasmc build` 时，对每个条目：

1. 静态遍历依赖图，重新计算签名
2. 若签名匹配 **且** 产物文件存在 → ⚡️ **直接跳过**
3. 若签名不匹配（任意源文件变更）→ 正常编译，更新缓存

### 设计要点

* **可提交（Committable）**：`vasmc-build-state.yaml` 基于内容 Hash，与机器无关，应提交到版本控制，团队成员可直接共享增量缓存。
* **自动失效**：任何源文件（包括任意层级的传递依赖）变更，签名随之变化，增量 skip 自动失效，确保构建结果始终正确。
* **对 Agent 模式透明**：`vasmc agent` 同样支持增量构建。若构建被跳过，`.vasmc/agent-instructions.md` 中不会生成对应条目，AI 编辑器自然跳过后续语义任务。

***

<a name="en"></a>

## 🌍 English

## Core Design Philosophy: Prompt as LLM Assembly

> *This concept is deeply inspired by the [Vibe Coding Framework](https://github.com/glenzli/vibe-coding-framework/blob/main/PRINCIPLES.md).*

In traditional thinking, a Prompt is treated as natural-language text that must "be readable by both humans and machines." VASMC breaks this compromise entirely, establishing the following core engineering principles for LLM infrastructure:

1. **Intent as Source Code, Prompt as Compiled Output**: In AI-Native architecture, system-level instructions (e.g., System Prompts, fixed SKILL workflow descriptions) should be treated strictly as "assembly language (Assembly / Machine Code)" that drives the underlying model. The developer's "natural-language intent" and abstract topology (composed via `vasm:alias`) is the true Source Code.
2. **No Manual Prompt Tweaking**: Humans should not, and do not need to, manually craft validated high-dimensional Prompts at the text level. The sole evaluation criterion for a Prompt is "does it reliably trigger the correct behavior in the underlying model?" This modular assembly should be delegated to a static linker like VASMC. Ad-hoc "voodoo" tweaking is strictly prohibited.
3. **Closed-Loop Agentic Compilation Workflow**: Functional modifications to system Prompts must be completed through a closed loop of LLM-autonomous generation, execution, verification, and correction. The `vasmc agent` command is the physical carrier of this workflow — it elevates VASMC to an objective "compiler frontend," with an external Agent taking over the semantic second half of compilation (optimization, pruning, and translation) after reading AST directives.
4. **Cross-Compilation Targets**: When a Prompt is treated as machine code, its specific language is no longer traditional "internationalization (i18n)" — it's specifying a "CPU architecture" (different models parse different language families with different efficiency). VASMC supports writing intent source files in your native language (high-level language), then using LLM to cross-compile pure target-language Prompt machine instructions, eliminating token waste and hallucinations caused by mixing bilingual content in a single large file.
5. **Semantic Compilation via Vision**: A true compiler not only performs structural transformation — it also guarantees semantic correctness. VASMC allows developers to declare `vision` (the semantic target the compiled output should achieve) in source file Frontmatter, and control the repair strategy via `fix: suggest | auto`. In the `vasmc agent` Verify Pass, the AI coordinator checks compiled output against the vision for intent alignment — `suggest` mode outputs suggested edits awaiting confirmation, `auto` mode directly edits the product file and reports a change summary. This elevates VASMC from a "structural linker" to a "semantic compiler."
6. **Input Sovereignty**: In AI-Native systems, the context window is simultaneously the execution space and the data space — LLM architecturally cannot distinguish "instructions to be executed" from "data to be processed." The entire input surface is the execution surface. VASMC is **the only deterministic control point established at the input layer** under this architectural constraint: all content entering the execution surface must pass through explicit declaration and assembly via the compilation chain, with traceable provenance, typed format classification (`prompt` vs `doc` distinction is a compile-time security classification primitive), and no possibility of implicit contamination. VASMC does not attempt to fix the LLM execution layer — instead, it deterministically encodes human sovereign intent before the execution surface is formed.

VASMC is a lightweight, decentralized Markdown package manager and **cross-platform compiler** designed for LLM development workflows. It treats Markdown as high-level engineering abstraction code, providing dependency management, inline composition, deterministic builds, and input sovereignty guarantees — without relying on any centralized registry.

***

## Part 1: Package Manifest (Install)

VASMC uses manifest files to declare remote dependencies, which are then referenced in source files. This avoids hard-coded URLs, facilitates version control, and establishes unified module aliases (Aliases) locally.

### 1. Manifest File (`vasmc.yaml`)

`vasmc.yaml` is located in the project root. Its core function is to map remote URLs to unique local aliases.

```yaml
dependencies:
  # Scenario A: Cache-only dependency. Downloaded to internal cache only, invisible in workspace.
  # Used for pure text fragments to be consumed via inline expansion.
  company-rules: "https://example.com/guidelines.md"
  
  # Scenario B: Explicit physical persistence. Downloaded to a specified local path.
  # Used for building local knowledge bases or skill library directories.
  coder-skill:
    url: "https://example.com/coder-skill.md"
    dest: "./skills/coder.md"
```

### 2. Alias Generation and Conflict Resolution

VASMC requires developers to guarantee alias uniqueness within the project's `vasmc.yaml`.
* **Local Unique Identifier**: Within a project, the alias (e.g., `company-rules`) is the primary key. If a duplicate alias is declared, the resolver will overwrite or throw an error.
* By decoupling the target URL from the local Alias, VASMC avoids global naming conflicts.

When developers manually edit `vasmc.yaml`, the declared key is used as the alias.
When installing via CLI tool `vasmc add <url>`, the system generates aliases with the following priority:
1. **Explicit specification**: The command-line parameter `--alias` (e.g., `vasmc add https://.../foo.md --alias bar`) has the highest priority.
2. **Filename inference**: By default, the last path segment of the URL with the extension removed is used as the alias (e.g., `.../my-skill.md` infers `my-skill`).
3. **Suffix increment collision avoidance**: If the inferred alias already exists in `vasmc.yaml`, a numeric suffix is automatically appended (e.g., `my-skill-1`) to prevent configuration overwrite. Developers can manually rename it afterward.

### 3. Local Cache Directory and Version Control

When no `dest` is specified in the dependency declaration, `vasmc sync` downloads the file to the **`.vasmc/`** hidden directory in the project root (e.g., `.vasmc/company-rules.md`). This directory is a pure internal cache and should be excluded via `.gitignore`:

```gitignore
# VASMC internal cache (auto-managed by vasmc sync)
.vasmc/
```

> **Note**: `vasmc-lock.yaml` should be **committed to version control**. Like `package-lock.json`, it guarantees deterministic builds — team members running `vasmc sync` will restore a fully consistent dependency state based on this file.

***

## Part 2: Code Import (Import)

After installing dependencies, they can be referenced in source files (e.g., `.vasm.md`) via the `vasm:{alias}` protocol.

VASM adopts a backward-compatible design principle: encoding compilation directives as the Title attribute of standard Markdown links, ensuring that uncompiled source files remain readable in standard Markdown readers.

### Import Syntax

`[Link Text](vasm:alias "@vasm-directive")`

* **Link Rewrite Mode (`@import:link`)**:
  The compiler replaces `vasm:alias` with the target file's local relative physical path, preserving the hyperlink structure.
  ```markdown
  See the [Code Review Assistant Skill](vasm:coder-skill "@import:link") below.
  ```
  *Build output*: `See the [Code Review Assistant Skill](./skills/coder.md) below.`

* **Inline Expansion Mode (`@import:inline`)**:
  The compiler reads the target file's plain text content and directly replaces the reference link. Primarily used for assembling large Prompt contexts.
  ```markdown
  According to our [Company Development Guidelines](vasm:company-rules "@import:inline"):
  ```
  *Build output*: The original link is removed, and the complete text content of `guidelines.md` is inserted in its place.

***

## Part 3: VASMC Compiler Core & CLI Overview

The VASMC compiler (CLI tool) is the execution engine responsible for fulfilling the protocol.

### 1. Lock File (`vasmc-lock.yaml`)

If `vasmc.yaml` is written for humans, then `vasmc-lock.yaml` is purely generated and read by machines. It records the mapping between local Aliases and exact URLs, dest paths, and the ultimately resolved SHA-256 Hash (or Frontmatter version numbers). This guarantees 100% idempotent and deterministic synchronization on any machine.

### 2. CLI Command Architecture

The VASMC CLI strictly separates concerns, dividing commands into three categories:

**Deterministic Tools (Zero LLM Calls)**:
* `vasmc build [file]`: Pure deterministic compiler. Performs AST traversal, `@import` resolution, and cross-compilation translation. Translation is a core compiler capability (equivalent to gcc's cross-compilation backend), not an "enhanced feature." Note: the LLM translation backend only activates when called directly by humans; AI editors should use `vasmc agent` to bypass all LLM calls.
* `vasmc graph <file>`: Statically analyzes the AST and prints a visual ASCII dependency tree.
* `vasmc seal <patterns>`: Wraps standard Markdown files into VASM modules (injects Frontmatter, language tags).
* `vasmc sync`, `vasmc add`, `vasmc init`: Dependency management and project initialization.

**LLM-Enhanced Tools (Independent Subcommands, On-Demand)**:
* `vasmc lint <file>`: Performs LLM-driven semantic conflict detection on compiled outputs. Completely independent from the compilation process, like `clippy` is independent from `rustc`.
* `vasmc diff <file>`: Performs LLM-driven semantic diff analysis between old and new compiled outputs.

**Agent-Exclusive Tools**:
* `vasmc agent <file>`: The compilation frontend designed for AI editors. Performs pure deterministic AST assembly (zero LLM calls), outputs the `.vasmc/agent-instructions.md` orchestration directive, and delegates subsequent semantic pruning, conflict arbitration, and translation to the external AI editor.

> 👉 **Full Guide**: For detailed VASMC CLI usage, global `.vasmrc` configuration, and LLM integration guides, see the [**VASMC Help & Usage (HELP.md)**](HELP.md).

***

## Part 4: Version Management & Dependency Resolution

If a dependency URL comes from Gist or plain-text hosting, it typically has no explicit version number and content may change at any time. For this decentralized distribution model, VASMC uses the following mechanisms:

### 1. Recommend Distributing Compiled Outputs (Compiled Release)

To avoid LLMs encountering conflicting instructions at execution time, VASMC **does not recommend** deep nesting and distribution of dynamic dependencies.
If module B depends on module C, it's recommended that B's author first use `vasmc build` to compile it into a pure static Markdown file (all inline dependencies already expanded) before distributing.
Source files with `vasm:xxx` tags (`*.vasm.md`) are better suited for internal project use, with versions managed uniformly by `vasmc.yaml`.

### 2. Component Declaration Metadata (VASM Frontmatter Protocol)

VASMC encourages module authors to declare official aliases, version information, and their own remote dependencies in YAML Frontmatter at the top of source files. This not only aids human developers but is also the highest-priority information source for `vasmc add`'s intelligent parsing.

> **Best Practice (Extension and Dehydration Mechanism)**:
> It is strongly recommended that source files distributed as VASM modules use **`.vasm.md`** as the extension.
> This is an important boundary: files containing YAML Frontmatter and `@import` directives are engineering source files for "humans and the VASMC compiler." When end users run `vasmc build`, the compiler automatically performs **demetadata-ization (dehydration)**, silently stripping all YAML Frontmatter. The final `.md` output will be absolutely pure natural language, ensuring no noise interference to the LLM's attention.

```yaml
---
vasm:
  alias: "my-coder-prompt"
  version: "1.0.0"
  dependencies:
    anti-delusion: "https://example.com/system.md"
---

# Your Prompt Content...
```

* **alias**: Strongly recommended. When other users run `vasmc add <your-link>`, VASMC will preferentially use this field as the mapping alias in their namespace.
* **version**: Metadata for human compatibility assessment (the VASMC engine uses only content Hash as the ground truth for locking versions).
* **dependencies**: Declares **essential remote dependencies** for the module to run. When users pull your module, VASMC's `sync` engine will automatically read these nested dependencies and install them flat alongside them in their workspace (following the "sovereignty override" anti-conflict principle).

### 3. Flat Resolution & Semantic Linting

For nested dependencies that must be included, VASMC uses a globally flat Alias namespace and does not allow multi-version nesting (like npm does).
When the main project and sub-dependencies need the same module, VASMC does not violently perform "namespace hard-replacement" like traditional package managers. Because forceful replacement of natural-language Prompts often leads to context rupture and logic failure.
When logical or definitional conflicts are encountered, VASMC delegates the problem to the **LLM Linter**. After compilation, run `vasmc lint <file>` to let the LLM determine whether different modules assembled together have irreconcilable conflicts, then let developers perform targeted refactoring based on the report.

### 4. Hash-Based Local Locking

The first time `vasmc sync` is run, VASMC calculates the SHA-256 Hash of downloaded content and records it in `vasmc-lock.yaml`.
Subsequent compilations are based on local cache. Even if upstream URL content changes, as long as the local cache has not been cleared and `vasmc update <alias>` has not been executed, the compiler will always use a deterministic local data block, preventing remote file silent changes from breaking build consistency.

> **On the Role of Version Numbers**: In traditional package managers, version numbers (Version) determine code distribution resolution. But in VASMC's underlying execution logic, **Hash is the only ground truth**. Although we still recommend module authors add the `version` field to Markdown Frontmatter for human semantic understanding and compatibility assessment, the VASMC core execution engine always relies solely on pure content Hash for sensing dependency changes.

### 5. Local Relative Path Imports

When your Prompt modules are split within the same local project, forcing `vasmc.yaml` declaration configuration is unnecessary.
Within a project, you can directly use native Markdown relative paths for imports:

```markdown
# My System Prompt
[Import Local Persona](./prompts/persona.vasm.md "@import:inline")
[Import Remote Anti-Hallucination Module](vasm:anti-delusion "@import:inline")
```

The compiler automatically recognizes links starting with `./` or `../`. Not only does it allow click-to-jump in mainstream editors, but **locally-referenced files are not subject to forced Hash Lock computation**, natively supporting local real-time debugging and hot modifications.

***

## Part 5: Skill Flywheel & Self-Bootstrapping

VASMC is not only a compiler — it also maintains and updates its own skill knowledge base through its own compilation capabilities. This forms a closed-loop self-bootstrapping flywheel.

### 1. Flywheel Architecture

Using VASMC's own bundled `vasm-expert` skill as an example, the engineering topology is:

```
skill-src/vasm-expert/                       # Engineering source directory
├── vasm-expert.vasm.md                     # Main entry (high-level language source)
│   ├── @import:inline vasmc-knowledge.md    #   ← AI knowledge manual
│   └── @import:inline agent-coordinator    #   ← Agent coordination protocol
├── vasmc-knowledge.md                       # Knowledge manual (distilled by LLM)
├── agent-coordinator.vasm.md              # vasmc agent mode operation manual
└── extract-vasmc-knowledge.vasm.md         # Extraction pipeline Prompt (instructions for generating the knowledge manual)

skills/vasm-expert/                         # Compiled output directory (clean)
└── vasm-expert.md                          # The sole executable file (statically linked body)
```

### 2. Flywheel Cycle

When VASMC's design documents or CLI change, the flywheel runs automatically:

```
  ┌──────────────────────────────────────────────────────┐
  │  DESIGN.vasm.md / HELP.vasm.md changes               │
  │          ↓ vasmc build (compile docs)                  │
  │  DESIGN.md / HELP.md (latest compiled outputs)        │
  │          ↓ extract-vasmc-knowledge.vasm.md            │
  │          ↓ (expanded as Prompt fed to AI editor)      │
  │  AI editor outputs new vasmc-knowledge.md (distilled) │
  │          ↓ overwrites skill-src/.../vasmc-knowledge.md│
  │          ↓ vasmc build (recompile skill)              │
  │  skills/vasm-expert/vasm-expert.md (updated machine code) │
  └──────────────────────────────────────────────────────┘
```

### 3. Design Principles

* **Self-Contained (Static Linking)**: The final skill file must be a self-contained closure. An AI editor only needs to load `vasm-expert.md` to get the syntax reference, CLI docs, and `vasmc agent` mode operation protocol simultaneously. No runtime external dependencies allowed — "load and use, zero broken links."
* **Knowledge Distillation Separation**: `vasmc-knowledge.md` is an AI-specific knowledge manual distilled by the AI editor from source documents based on `extract-vasmc-knowledge.vasm.md` instructions. It is not handwritten — it can be regenerated at any time by re-running the extraction pipeline.
* **Pipeline as Prompt**: `extract-vasmc-knowledge.vasm.md` is itself a VASM source file that pulls the latest compiled documents as context via `@import:inline`, instructing the AI editor to generate a new knowledge manual. This means **the extraction pipeline itself is also modular code managed by VASMC**.
* **Language Consistency**: All inline materials within skill files (`exec` format) must be consistent with the target compilation language, avoiding mixing multiple languages in a single executable that would cause LLM attention dilution.

***

## Part 6: AI-Native Input Security Model (Input Sovereignty)

### 1. Root Cause: Data as Instruction

In Von Neumann architecture, the core premise of security engineering is guaranteeing **strict isolation between code and data** — instructions in the code segment, data in the data segment, crossing the boundary means crossing authority. This premise **fundamentally does not hold** in AI-Native systems.

Because RLHF's training objective is to make models compliant responders, LLMs architecturally **cannot distinguish "instructions to be executed" from "data to be processed"**. All tokens entering the context window are equal in the attention mechanism's eyes. A more accurate description:

> **AI-Native systems run natively with `root` privileges — the entire context window is both execution space and data space; LLM is a global `eval()` acting on the full input domain, trained to execute as compliantly as possible.**

Traditional security engineering waits for attackers to "breach the boundary"; in AI-Native, there is no boundary to breach, because models never refuse to execute any instruction in their input. Security cannot by design rely on the model's own discrimination ability.

### 2. VASMC's Response: Compile-Time Input Sovereignty

VASMC does not attempt to fix the LLM execution layer (that is impossible) — instead, it establishes a deterministic control point **before the execution surface is formed**.

**Three Security Primitives**:

* **Provenance Auditability**: All content entering the execution surface must go through the explicit path of `.vasm.md` source files → compilation chain → `.md` products. External content can only enter the build chain via explicit declaration through `vasmc add` + `vasmc sync`. No implicit imports exist. Every token entering the context has a traceable human-authorized source.

* **Format Classification as Security Classification**: The `compile.format: prompt | doc` distinction is far more than "different compilation behavior" — it is humanity's **sovereign declaration** of content intent at build time:
  * `prompt`: Declared as instructional content entering the LLM execution surface
  * `doc`: Declared as informational content for human reading, **should not appear in system prompts**

  In Von Neumann architecture, code segments and data segments are isolated by CPU hardware. LLM cannot do this — VASMC moves this isolation earlier to **compile time**, explicitly declared by humans, rather than expecting models to discriminate at runtime.

* **Content Determinism**: Compilation is pure deterministic AST assembly; output content is fully predictable, auditable, and reproducible. Attackers cannot silently inject unauthorized content during the build process.

### 3. VASMC's Boundaries

VASMC's trust boundary is the **controlled input path** — content entering system prompts via the compilation chain. It cannot defend against:
* Prompt injection in user dynamic inputs
* Malicious content in tool call return values
* Injection in RAG-retrieved content

These fall under **runtime defense** and require other mechanisms. VASMC addresses: **does the portion of input you can control — system prompts and skill files — truly contain only what you authorized?**

### 4. Compile-Time Static Security Guarantees

* **Strict DAG Enforcement**: `vasmc build` maintains a call stack; upon detecting a cycle (`A → B → C → A`), immediately reports a fatal error, preventing dependency graphs from being maliciously constructed as infinite expansions.
* **Write Conflict Prevention**: Pre-checks before `sync`; if the same `dest` path is declared by multiple Aliases, immediately throws a fatal conflict error.
* **Unknown Alias Interception**: Upon encountering an unregistered `vasm:unknown-alias` during compilation, immediately terminates — unauthorized dependencies cannot be silently resolved.

***

## Part 7: Incremental Builds

VASMC supports content Hash-based incremental builds, completely transparent to users — the command is unchanged, builds automatically accelerate.

### How It Works

After each successful compilation, VASMC writes the SHA-256 signatures of all source files (entry file + all transitive dependencies) to `vasmc-build-state.yaml`:

```yaml
version: 1
entries:
  "docs-src/DESIGN.vasm.md|merged":
    inputSignature: "abc123..."
    outputFile: DESIGN.md
    targetLang: zh-CN
```

The next time `vasmc build` runs, for each entry:

1. Statically traverse the dependency graph and recalculate signatures
2. If signatures match **and** the output file exists → ⚡️ **Skip directly**
3. If signatures don't match (any source file changed) → compile normally, update cache

### Design Highlights

* **Committable**: `vasmc-build-state.yaml` is content Hash-based, machine-independent, and should be committed to version control — team members can directly share incremental cache.
* **Auto-Invalidation**: Any source file change (including any level of transitive dependencies) changes the signature, automatically invalidating the incremental skip, ensuring build results are always correct.
* **Transparent to Agent Mode**: `vasmc agent` also supports incremental builds. If a build is skipped, no corresponding entry is generated in `.vasmc/agent-instructions.md`, and the AI editor naturally skips subsequent semantic tasks.
