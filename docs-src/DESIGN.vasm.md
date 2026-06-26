---
vasm:
  compile:
    format: "doc"
    targetLangs: ["zh-CN"]
---

# VASM 协议与 VASMC 跨平台编译器规范

## 核心设计哲学：Prompt 汇编化 (Prompt as LLM Assembly)

> *该理念受 [Vibe Coding Framework](https://github.com/glenzli/vibe-coding-framework/blob/main/PRINCIPLES.md) 的深刻启发。*

在传统的思维中，Prompt 被视为“既要写给人看，又要写给机器看”的自然语言文本。VASMC 彻底打破了这种妥协，确立了以下大模型基础设施的核心工程共识：

1. **意图即源码，Prompt 即编译产物**：在 AI-Native 架构中，系统级的指令（如 System-Prompt、固化的 SKILL 流程说明）应当被严格视为用于驱动底层模型的“汇编语言（Assembly / Machine Code）”。人类开发者的“自然语言意图”和抽象拓扑结构（通过 `vasm:alias` 组合）才是真正的 Source Code（源码）。
2. **拒绝手工字句微调 (No Manual Prompt Tweaking)**：人类不应当，也不需要直接在文本级手工雕琢已被验证的高维 Prompt。Prompt 的唯一评价标准是“能否稳定触发底层模型的正确动作”。这种模块化组装应该交给像 VASMC 这样的静态链接器，系统严禁基于“玄学”的手工微调。
3. **闭环编译体系 (Agentic Compilation Workflow)**：对系统 Prompt 的功能性修改必须借由 LLM 自主生成、执行、验证、修正的闭环完成。AI 侧 `vasmc build` 命令正是这一流程的物理载体，将 VASMC 提升为了客观的“编译器前端”，由当前 AI 读取 AST 指令后接管编译的后半段过程（优化、剪裁与翻译）。
4. **多语种交叉编译 (Cross-Compilation Targets)**：当 Prompt 被视为机器码，它的具体语种就不再是传统意义上的"国际化（i18n）"，而是指定"CPU 架构"（各模型对不同语系的解析性能不同）。VASMC 支持使用母语编写意图源文件（高级语言），先由确定性编译器过滤已有语种块，再通过 `vasmc build` 工作单把缺失目标语种交给当前 AI 处理，从而消灭在同一份大文件中杂糅双语对照导致的 Token 浪费与幻觉问题。
5. **语义编译与意图规约 (Semantic Compilation via Vision)**：真正的编译器不只做结构变换，还要保证语义正确性。VASMC 允许开发者在源文件 Frontmatter 中声明 `vision`（产物应达成的语义目标），并通过 `fix: suggest | auto` 控制修复策略。在 AI build 的 Verify Pass 中，AI 协调器将对照 vision 检查编译产物的意图对齐程度——`suggest` 模式输出修改建议等待确认，`auto` 模式直接编辑产物文件并报告变更摘要。这将 VASMC 从"结构链接器"升格为"语义编译器"。
6. **输入面主权 (Input Sovereignty)**：在 AI-Native 系统中，上下文窗口既是执行空间也是数据空间——LLM 在架构层面无法区分"应当执行的指令"与"应当处理的数据"，整个输入面即执行面。VASMC 是这一架构约束下**在输入层建立的唯一确定性控制点**：所有进入执行面的内容都必须经过编译链的显式声明与组装，来源可追溯，格式有分类（`prompt` 与 `doc` 的区分是编译期的安全分类原语），内容不可被隐式污染。VASMC 不试图修复 LLM 的执行层，而是在执行面形成之前，将人类的主权意志确定性地写入其中。


VASMC 是一个专为 LLM 相关开发流设计的轻量级、去中心化 Markdown 包管理器与 **跨平台编译器**。它将 Markdown 视为高级工程抽象代码，提供依赖管理、内联组合、确定性构建和输入面主权保障机制，且不依赖任何中心化注册表。

---

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
*   **本地唯一标识**：在项目中，别名（如 `company-rules`）是主键。若声明重复的别名，解析器将直接覆盖或抛出错误。
*   通过将目标 URL 与本地 Alias 解耦，VASMC 规避了全局命名冲突问题。

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

---

## Part 2: 代码引入 (Import)

依赖安装后，可在源文件（如 `.vasm.md`）中通过 `vasm:{alias}` 协议进行引用。

VASM 采用向下兼容的设计原则：将编译指令编码为标准 Markdown 链接的 Title 属性，以确保未编译的源文件在通用阅读器中保持可读。

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

---

## Part 3: VASMC 编译器核心与包边界

VASMC 编译器是负责兑现协议的执行引擎。monorepo 内部按使用边界拆成三类发布包：

* `@vasm/core`：共享确定性核心。实现 VASM 协议解析、依赖图、Frontmatter 脱水、语言块过滤、工作区构建与合并，不包含外部模型 SDK。
* `@vasm/cli`：发布 `vasmc` 命令。面向 AI 编辑器和自动化流程，提供 AI build：确定性编译产物 + 后续语义工作单。
* `@vasm/console`：发布 `vasm-console` 命令。面向人类开发者，承载可选外部模型能力，例如语义 lint 和语义 diff。

### 1. 锁文件 (`vasmc-lock.yaml`)

如果说 `vasmc.yaml` 是给人写的，那么 `vasmc-lock.yaml` 就是纯粹由机器生成和阅读的。它记录了本地 Alias 与确切 URL、dest 路径以及最终解析到的 SHA-256 Hash（或 Frontmatter 版本号）的映射关系。这保证了在任何机器上执行同步都是 100% 幂等和确定的。

### 2. CLI 命令架构

VASMC CLI 采用严格的关注点分离原则，将命令分为三类：

**AI 编译工具（`@vasm/cli` / `vasmc`）**：
*   `vasmc build [file]`：AI 侧唯一编译入口。执行确定性的 AST 遍历、`@import` 解析、语言块过滤和产物写入，并输出 `.vasmc/build-instructions.md` 编排操作令与 `.vasmc/build-report.yaml` 结构化构建报告。若目标语言缺失，它不会调用外部模型自动补全，而是把翻译、校验、Diff、Policy Review、Policy Gate、Project Review、裁剪等语义任务交给当前 AI。
*   `vasmc graph <file>`：静态分析 AST 并打印依赖关系的可视化 ASCII 树。
*   `vasmc seal <patterns>`：将普通 Markdown 封装为 VASM 模块（注入 Frontmatter、语言标签）。
*   `vasmc sync`、`vasmc add`、`vasmc init`：依赖管理与项目初始化。

**人类可选外部模型工具（`@vasm/console` / `vasm-console`）**：
*   `vasm-console lint <file>`：对已编译产物执行 LLM 驱动的语义冲突检测。完全独立于确定性编译流程，就像 `clippy` 独立于 `rustc`。
*   `vasm-console diff <file> [old-file]`：对新旧编译产物执行 LLM 驱动的语义对比分析。

> 👉 **完整指南**：关于 VASMC 命令行、包边界和 console 外部模型配置，请参阅 [**VASMC 帮助文档 (HELP.md)**](HELP.md)。

---

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

*   **alias**：强烈建议填写。当其他用户执行 `vasmc add <你的链接>` 时，VASMC 会优先使用此字段作为其命名空间中的映射别名。
*   **version**：供人类评估兼容性使用的元数据（VASMC 引擎锁定版本时仅以内容 Hash 为唯一真理）。
*   **dependencies**：声明当前模块运行**不可或缺的远程依赖**。当用户拉取你的模块时，VASMC 的 `sync` 引擎会自动读取这些嵌套依赖，并将其扁平化地一并安装到他们的工作区中（遵循“主权覆写”防冲突原则）。

### 3. 扁平化命名与语义冲突解决 (Flat Resolution & Semantic Linting)

对于必须引入的嵌套依赖，VASMC 采用全局扁平的 Alias 命名空间，不允许多版本嵌套（像 npm 那样）。
当主项目和子依赖需要同一个模块时，VASMC 不会像传统包管理器那样对组件进行暴力的“命名空间硬覆盖替换”。因为自然语言构成的 Prompt 强行替换往往会导致上下文断裂和逻辑失控。
遇到逻辑或定义分歧时，确定性编译器只负责暴露组装结果，不替人类或 AI 做语义裁决。人类可以在编译完成后执行 `vasm-console lint <file>`，让外部模型判断不同模块拼装后是否存在无法调和的冲突；AI 编辑器则应通过 `vasmc build` 读取工作单中的 Verify 项并自行完成判断。

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

### 6. Skill Manifest 治理字段 (Skill Policy Surface)

Skill 泛滥后，核心问题不再是“能否引入”，而是“为什么选择这个 skill、它的能力边界是什么、是否与其他 skill 冲突”。VASMC 因此支持在 `vasm:` Frontmatter 中声明治理字段：

```yaml
vasm:
  kind: skill
  scope:
    domains: ["security", "code-review"]
    filePatterns: ["**/*.ts"]
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
    source: "github:example/security-skill"
    license: "MIT"
```

`kind: skill` 会启用更严格的 manifest 诊断。诊断不会在默认情况下中断确定性构建，而是写入 `.vasmc/build-report.yaml`；若存在需要 AI 处理的问题，`vasmc build` 会在 `.vasmc/build-instructions.md` 中生成 **Policy Review** 工作项。

### 7. 确定性安全闸门 (Deterministic Policy Gate)

VASMC 不把 Prompt 自身当作安全边界。模型可能被诱导，审核也可能误判；因此当前核心层先实现不依赖额外模型或外部接口的 L1 确定性闸门：

* **manifest 结构检查**：非法 `kind`、非布尔 capability、错误 activation 结构等会进入 policy diagnostics。
* **远程依赖锁检查**：`vasmc-lock.yaml` 中的依赖 hash 与本地文件不一致时，policy 标记为 `blocked`。
* **capability 越权检查**：若依赖声明了入口 skill 未声明的 capability，policy 标记为 `blocked`。
* **activation 抢占检查**：过宽 intent 或过高 priority 会进入 `review`。
* **危险语义扫描**：疑似忽略上级指令、隐藏行为、密钥外传、下载并执行远程代码等文本会进入 `review`。

每个 entry 在 `.vasmc/build-report.yaml` 中都有 `policy.status`：

```yaml
policy:
  status: pass     # pass | review | blocked
  enforceable: true
```

默认模式是报告风险但不阻断输出：

```yaml
security:
  mode: review
```

项目可以显式切换到本地阻断：

```yaml
security:
  mode: enforce
```

`enforce` 只阻止可执行 skill 类产物更新。它不是完整沙箱，也不能阻止同一个 AI 在后续对话中被诱导；它的价值是把“确定性可发现的越权/篡改/结构错误”挡在正式 skill 输出之前。更强的隔离仍应由宿主编辑器、MCP proxy 或无工具 reviewer 提供。

### 8. 项目感知 AI Pass (Project Review)

传统编译器通常到“生成产物”即结束；VASM 面对的是给 AI 消费的 Prompt/Skill，因此编译完成后更有价值的一步，是让当前 AI 结合项目事实主动审查产物是否仍然贴合项目。

VASMC 不在核心内置模型，也不自动改仓库。它只在配置开启时生成项目上下文索引和工作单：

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

`vasmc build` 会输出 `.vasmc/project-review-context.yaml`，其中包含被纳入审查的项目文件路径、大小和 hash。随后 `.vasmc/build-instructions.md` 会加入 **Project Review** 工作项，让 AI 读取 context index、build report 和相关项目文件，给出源文件级建议。

这个 pass 适合发现：

* skill 描述是否过宽，容易误激活。
* capabilities 是否可以继续收窄。
* prompt 是否缺少项目实际命令、目录结构、发布约束或安全策略。
* README、docs、skill 之间术语是否不一致。
* 多处重复内容是否应该抽成 fragment。
* 哪些隐性项目知识应该写回 `.vasm.md` 源文件。

`mode: suggest` 只要求 AI 输出建议；`mode: patch` 允许 AI 给出聚焦的源文件 patch 建议。两者都不允许直接编辑生成物。

---

## Part 5: 技能飞轮与自举 (Skill Flywheel & Self-Bootstrapping)

VASMC 不仅是编译器，它还通过自身的编译能力来维护和更新自己的技能知识库。这形成了一个闭环的自举飞轮（Flywheel）。

### 1. 飞轮架构

以 VASMC 自身附带的 `vasm-expert` 技能为例，其工程拓扑如下：

```
skill-src/vasm-expert/                       # 工程源码目录
├── vasm-expert.vasm.md                     # 主入口（高级语言源码）
│   ├── @import:inline vasmc-knowledge.md    #   ← AI 知识手册
│   └── @import:inline ai-build-coordinator #   ← AI build 协调规程
├── vasmc-knowledge.md                       # 知识手册（由 LLM 蒸馏生成）
├── ai-build-coordinator.vasm.md           # vasmc build 操作手册
└── extract-vasmc-knowledge.vasm.md         # 提取流水线 Prompt（生成知识手册的指令）

skills/vasm-expert/                         # 编译产物目录（纯净）
└── SKILL.md                                # 唯一的可执行文件（静态链接体）
```

### 2. 飞轮循环

当 VASMC 的设计文档或 CLI 发生变更时，飞轮自动运转：

```
  ┌──────────────────────────────────────────────────────┐
  │  docs-src / packages/*/docs-src 源文档发生变更        │
  │          ↓ vasmc build (编译文档)                      │
  │  README.md / HELP.md / docs/ / package docs/          │
  │          ↓ extract-vasmc-knowledge.vasm.md            │
  │          ↓ (展开后作为 Prompt 喂给 AI 编辑器)          │
  │  AI 编辑器输出新的 vasmc-knowledge.md (知识手册蒸馏)    │
  │          ↓ 覆写 skill-src/.../vasmc-knowledge.md      │
  │          ↓ vasmc build (重编译技能)                    │
  │  skills/vasm-expert/SKILL.md (更新后的机器码)          │
  └──────────────────────────────────────────────────────┘
```

### 3. 设计原则

*   **自包含（Static Linking）**：最终产出的技能文件必须是一个自包含的闭包。AI 编辑器只需加载 `skills/vasm-expert/SKILL.md` 这一个文件，即可同时获得语法速查、CLI 参考和 `vasmc build` 操作规程。不允许出现运行时的外部依赖——"加载即可用，零断链"。
*   **知识蒸馏分离**：`vasmc-knowledge.md` 是由 AI 编辑器根据 `extract-vasmc-knowledge.vasm.md` 的指令从源文档中蒸馏出来的 AI 专用知识手册。它不是手写的，而是随时可以通过重新执行提取流水线来再生的中间产物。
*   **流水线即 Prompt**：`extract-vasmc-knowledge.vasm.md` 本身就是一个 VASM 源文件，它通过 `@import:inline` 拉入最新的编译文档作为上下文，指导 AI 编辑器生成新的知识手册。这意味着**提取流水线本身也是由 VASMC 管理的模块化代码**。
*   **语种一致性**：技能文件（`prompt` 格式）内部的所有内联素材必须与目标编译语种保持一致，避免在单一可执行体中混杂多种语言而导致 LLM 注意力分散。

---

## Part 6: AI-Native 输入面安全模型 (Input Sovereignty)

### 1. 问题根源：数据即指令

在冯诺伊曼架构中，安全工程的核心命题是保障**代码与数据的严格隔离**——指令在代码段，数据在数据段，越界即越权。这一前提在 AI-Native 系统中**根本不成立**。

由于 RLHF 的训练目标是让模型成为顺从的响应者，大模型在架构层面**无法区分「应当执行的指令」与「应当处理的数据」**。进入上下文窗口的所有 token 在注意力机制眼中是平权的。更准确的描述是：

> **AI-Native 系统天然以 `root` 权限运行——整个上下文窗口既是执行空间也是数据空间，LLM 是作用于全域输入的全局 `eval()`，且被训练为尽可能顺从执行。**

传统安全工程等待攻击者"穿透边界"；AI-Native 中根本没有边界可被穿透，因为模型从不拒绝执行输入中的任何指令。安全性从设计上就不能依赖模型自身的辨别能力。

### 2. VASMC 的应对：编译期输入主权

VASMC 不试图修复 LLM 执行层（这是不可能的），而是在**执行面形成之前**建立确定性的控制点。

**三个安全原语**：

*   **来源可审计（Provenance）**：所有进入执行面的内容，必须经过 `.vasm.md` 源文件 → 编译链 → `.md` 产物的显式路径。外部内容只能通过 `vasmc add` + `vasmc sync` 的显式声明进入构建链，不存在隐式引入。进入上下文的每一个 token 都有可追溯的人类授权来源。

*   **格式分类即安全分类（Format Classification）**：`compile.format: prompt | doc` 的区分远不只是"编译行为不同"——它是人类在构建期对内容用途的**主权声明**：
    *   `prompt`：声明为进入 LLM 执行面的指令内容
    *   `doc`：声明为供人类阅读的信息内容，**不应出现在 system prompt 中**

    在冯诺伊曼架构中，代码段与数据段由 CPU 硬件强制隔离。LLM 做不到这件事——VASMC 把这个隔离提前到**编译期**，由人类显式声明，而非期待模型运行时辨别。

*   **内容确定性（Determinism）**：编译是纯确定性的 AST 组装，产物内容完全可预期、可审计、可复现。攻击者无法在构建过程中静默注入未授权内容。

### 3. VASMC 的边界

VASMC 的信任边界是**控制路径（controlled input path）**——即通过编译链进入 system prompt 的内容。它不能防御：
- 用户动态输入中的 prompt injection
- 工具调用返回值中的恶意内容
- RAG 检索内容中的注入

这些属于**运行时防御**的范畴，需要其他机制处理。VASMC 解决的是：**你能控制的那部分输入——system prompt 与 skill 文件——是否真的只包含你授权的内容**。

### 4. 编译时静态安全保证

*   **严格防范循环依赖 (Strict DAG Enforcement)**：`vasmc build` 维护调用栈，一旦检测到闭环（`A → B → C → A`），立即报致命错误，防止依赖图被恶意构造为无限展开。
*   **写入冲突防范**：`sync` 前做静态预检，同一 `dest` 路径被多个 Alias 声明时，立即抛出致命冲突错误。
*   **未知别名拦截**：编译过程中遇到未在清单中注册的 `vasm:unknown-alias`，立即终止，不允许未经授权的依赖静默解析。

---

## Part 7: 增量构建 (Incremental Build)

VASMC 支持基于内容 Hash 的增量构建，对用户完全透明——命令不变，构建自动加速。

### 工作原理

每次成功编译后，VASMC 将所有源文件（入口文件 + 所有传递依赖）的内容 SHA-256 签名写入 `vasmc-build-state.yaml`：

```yaml
version: 1
entries:
  "docs-src/DESIGN.vasm.md|merged":
    inputSignature: "abc123..."
    outputFile: docs/DESIGN.md
    targetLang: zh-CN
```

下次执行 `vasmc build` 时，对每个条目：

1. 静态遍历依赖图，重新计算签名
2. 若签名匹配 **且** 产物文件存在 → ⚡️ **直接跳过**
3. 若签名不匹配（任意源文件变更）→ 正常编译，更新缓存

### 设计要点

*   **可提交（Committable）**：`vasmc-build-state.yaml` 基于内容 Hash，与机器无关，应提交到版本控制，团队成员可直接共享增量缓存。
*   **自动失效**：任何源文件（包括任意层级的传递依赖）变更，签名随之变化，增量 skip 自动失效，确保构建结果始终正确。
*   **对 AI build 透明**：`vasmc build` 同样支持增量构建。若构建被跳过，`.vasmc/build-instructions.md` 中不会生成对应条目，AI 编辑器自然跳过后续语义任务。
