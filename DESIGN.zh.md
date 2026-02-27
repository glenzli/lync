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

依赖安装后，可在源文件（如 `.src.md`）中通过 `lync:{alias}` 协议协议进行引用。

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
    *   **行为**：自动截取 URL 或者遵循 `--alias <name>` 参数生成别名，探测目标 URL 并保存进 `lync.yaml` 中，然后执行同步下载建立 Lock。如果携带 `--dest <path>` 参数，则会指定物理落盘位置。
*   `lync sync`:
    （默认指令，等同于 `lync install`）根据声明强行收敛状态的指令。
    *   **行为**：读取 `lync.yaml` 和 `lync-lock.yaml`。对于新增依赖或缺少本地文件的依赖，去远端拉取。如果 URL 已经在于 Lock 文件中，则优先使用本地锁定状态，保证构建行为确定性。
*   `lync update [alias]`:
    强制打破锁定状态更新库缓存的指令。
    *   **行为**：无视本地缓存和 Lock 文件的拦截，强制就某一 alias 或所有的 alias 去远端发送最新的网络请求，拿到最新内容后重新计算 Hash 并覆写到 `lync-lock.yaml`。
*   `lync build [entry]`:
    核心编译与展开指令。支持单个文件或目录级的批量编译：
    *   `lync build main.src.md`
    *   `lync build ./src/**/*.src.md --out-dir ./dist`
    *   **行为**：扫描入口并进行 AST 解析，拦截所有匹配的 `lync:alias` 自定义链接。将 `@import:inline` 指令内联展开，将 `@import:link` 降级重写。不仅支持局部传入 `--out-dir` 批量构建树状结构，更推荐不加参数默认执行基于 `lync-build.yaml` 配置的批量构建路由。

### 3. 编译配置文件 (Workspace Build Configuration)

对于包含多个文件的项目，特别是需要将输出产物分布到特定 Agent IDE 目录（如 Cursor、Windsurf 或 Cline 等）的工作流，Lync 提供全局构建路由能力。

由于 `lync.yaml` 往往被 `lync add` 命令自动修改和管理，而构建规则高度定制化且需要人类长期维护，因此 Lync 推荐将构建设定抽离为一个独立的配置文件：**`lync-build.yaml`**。

```yaml
# lync-build.yaml

# 搜集源文件的 Glob 模式
includes:
  - "src/**/*.src.md"

# 默认降级回写的总输出目录
outDir: "./dist"

# 输出路由干预 (Routing rules)
routing:
  # 场景 A：如果源文件或目标产物名字带有 .skill.md，自动写入 IDE 默认技能槽
  - match: "*.skill.md"
    dest: "./.agents/skills/"
  # 场景 B：针对单一主控入口，编译完成后强制覆盖 IDE 的全局 System 隐藏文件
  - match: "main.src.md"
    dest: "./.cursorrules" 
```

一旦项目根目录存在此配置，直接执行指令：
`lync build` （不携带任何参数）

此时编译器会读取 `lync-build.yaml`，遍历匹配的源文件，展开包含网络，并根据 `routing` 规则输出最终的纯文本 Markdown 到对应的物理目录，以完成批量编译与组件分发。

### 3. 安全性保证

*   **严格防范循环依赖 (Strict DAG Enforcement)**: 在执行 `lync build` 时，如果被引入的文件又递归引入了其他文件，编译器必须维护调用栈。一旦检测到闭环（`A -> B -> C -> A`），必须立即报致命错误。
*   **本地写入冲突防范**: 执行 `sync` 之前，Lync 必须做静态预检。如果在 `lync.yaml` 中发现两个不同的 Alias 被赋予了完全一样的 `dest` 写入路径，必须立即抛出致命冲突错误。
*   **未知别名拦截**: 如果 `build` 过程中遇到了未在清单中注册的 `lync:unknown-alias`，编译器应立即终止，并提示开发者先去 `lync.yaml` 中安装该依赖。
