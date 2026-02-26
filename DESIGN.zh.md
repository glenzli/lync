# Lync 协议与编译器规范 (草案)

考虑到 Markdown 已经成为大语言模型 (LLM) 时代实际意义上的逻辑控制语言（例如用于编写 Prompt、System Instruction 等），Markdown 实际上已经演变为了**源代码**。

Lync 是一个专为 LLM 时代设计的、轻量级、去中心化的 Markdown 包管理器与编译器。它将 Markdown 视为源代码，提供健全的依赖管理、内联组合和确定性构建机制，且**完全不依赖任何类似 npmjs 的中心化注册表**。

---

## Part 1: 包管理清单 (Install)

Lync 使用一个集中的清单文件来预先声明远程依赖，然后再在 Markdown 源文件中调用它们。这避免了 URL 在代码中到处散落，有利于版本控制，并能在本地建立极简的别名（Alias）。

### 1. 清单文件 (`lync.yaml`)

`lync.yaml` 位于项目根目录。它的核心作用是将一个冗长的远程 URL 绑定到一个简短的、本地唯一的**别名 (Alias)** 上。

```yaml
dependencies:
  # 场景 A：纯缓存依赖。仅下载到内部缓存，工作区不可见。
  # 完美适用于被用于内联展开 (Inline) 的背景上下文。
  company-rules: "https://example.com/guidelines.md"
  
  # 场景 B: 显式物理落盘。下载到本地指定的明确路径。
  # 完美适用于构建本地的知识库目录或技能文件夹。
  coder-skill:
    url: "https://example.com/coder-skill.md"
    dest: "./skills/coder.md"
```

### 2. 别名生成与冲突处理机制

在 Lync 中，开发者只需要保证别名在属于自己的 `lync.yaml` 中唯一即可。
*   **别名 (Alias) 即本地主键**：在你的项目中，`company-rules` 就是唯一的标识符。如果你在 YAML 里写了两个同名别名，解析器会直接覆盖或报错。
*   通过将“全球去中心化的 URL”与“本地自定义的 Alias”彻底解耦，Lync 极其优雅地解决了命名冲突问题：如果张三和李四都在网上发布了 `coder.md`，你只需要在清单里把它们别名化为 `coder-zs` 和 `coder-ls` 即可。

如果是开发者自己**手写 `lync.yaml` 文件**增加记录，那么**键 (如 `coder-skill`) 就是指定的 alias。**
如果是通过终端命令 `lync add <url>` 进行安装，由于没有手写设定 alias，CLI 必须按照如下优先级自动推导并生成 Alias 写入 `lync.yaml`：
1. **显式指定优先级最高**: 用户命令行提供 `--alias`，例如 `lync add https://.../foo.md --alias bar`，写入 `bar`。
2. **文件名推导**: 未显式指定时，摘取目标 URL 最后一部分并去除扩展名。例如 `.../my-skill.md` 推导为 `my-skill`。
3. **数字递增加后缀避免冲突**: 若推导得到的 `my-skill` 在本地 yaml 中已被占用，则自动递增数字后缀（如 `my-skill-1`），以确保不篡改不相关的既有配置。当然开发者随时可以进入 `lync.yaml` 重命名为更可读的名字。

---

## Part 2: 代码引入 (Import)

当包通过 `lync.yaml` 声明并安装到本地后，你就可以在你的 `.src.md` 源文件中通过自定义的 URI 协议 `lync:{alias}` 来引入它们了。

这里依然秉承**合法降级 (Graceful Degradation)** 哲学：所有的编译指令依然被隐藏在标准 Markdown 链接的 Title 属性中。

### 引入语法

`[人类可读的名字](lync:alias "@lync-directive")`

*   **链接路由模式 (`@import:link`)**: 
    编译器会将 `lync:alias` 仅仅重写为被下载文件的**本地相对物理路径**。这确保了在最终编译出的 Markdown 中，这是一个可点击跳转的有效链接。
    ```markdown
    请参阅下方的 [代码审查辅助技能](lync:coder-skill "@import:link")。
    ```
    *编译后产物*: `请参阅下方的 [代码审查辅助技能](./skills/coder.md)。`

*   **内联展开模式 (`@import:inline`)**:
    编译器会将该链接**整体替换**为所指向模块的全部原始文本内容。非常适合用来将多个碎片语料“拍扁”拼装成一个给 LLM 看的巨大 Prompt。
    ```markdown
    根据本组织的 [公司开发规范](lync:company-rules "@import:inline")：
    ```
    *编译后产物*: 这一行链接将灰飞烟灭，取而代之的是 `guidelines.md` 里面洋洋洒洒的纯文本规范。

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
*   `lync build <entry.src.md>`:
    核心编译与展开指令。
    *   **行为**：读取特定的 `entry.src.md` 入口文件进行 AST 树结构解析，所有匹配的 `lync:alias` 自定义链接都将被拦截处理。将带有 `@import:inline` 指令的链接从 `dest` 路径或缓存库中读取并向调用位置展开铺平；将带有 `@import:link` 指令的内容重写为指向本地物理地址的有效相对路径（例如 `./skills/foo.md`）。完成所有扫描后，将处理结束的平整纯文本生成给指定输出或大语言模型。

### 3. 安全性保证

*   **严格防范循环依赖 (Strict DAG Enforcement)**: 在执行 `lync build` 时，如果被引入的文件又递归引入了其他文件，编译器必须维护调用栈。一旦检测到闭环（`A -> B -> C -> A`），必须立即报致命错误。
*   **本地写入冲突防范**: 执行 `sync` 之前，Lync 必须做静态预检。如果在 `lync.yaml` 中发现两个不同的 Alias 被赋予了完全一样的 `dest` 写入路径，必须立即抛出致命冲突错误。
*   **未知别名拦截**: 如果 `build` 过程中遇到了未在清单中注册的 `lync:unknown-alias`，编译器应立即终止，并提示开发者先去 `lync.yaml` 中安装该依赖。
