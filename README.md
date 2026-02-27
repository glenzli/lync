# Lync 

🌍 [English](#english) | 🇨🇳 [中文](#chinese)

---

<a name="english"></a>
## 🌍 English

Lync is a lightweight, decentralized package manager and compiler designed specifically for Markdown files in the era of Large Language Models (LLMs). 

As LLMs increasingly use Markdown for logic control (e.g., Prompts, System Instructions), Markdown has effectively evolved into **source code**. Lync treats Markdown as such, providing robust mechanisms for dependency management, inline composition, and deterministic builds—**all without relying on any centralized registries like npmjs.**

👉 [Read the Full English Design Spec](DESIGN.en.md)

### 🌟 Core Design

The core design principle is **graceful degradation**. Compilation directives are encoded within standard Markdown link attributes (`[Title](lync:alias "@import:inline")`) to ensure uncompiled source files remain readable in generic viewers (like GitHub or Obsidian).

### 📦 Features

*   **Decentralized Package Management**: Install remote Markdown files directly via their URLs without relying on a central registry.
*   **Alias-Driven Dependency Management**: Use `lync.yaml` to map URLs to local aliases (e.g., `lync:coder-skill`), avoiding URL scattering and naming collisions.
*   **Deterministic Builds**: The `lync-lock.yaml` locks SHA-256 hashes of remote files to ensure reproducible builds.
*   **Two Import Modes**:
    *   `@import:link` (Link Rewrite): Rewrites virtual aliases to local physical paths, preserving hyperlink structure.
    *   `@import:inline` (Inline Expansion): Injects remote text in-place, suitable for assembling large prompt contexts.

### 🚀 Quick Start (Draft)

**1. Installation**
```bash
npm install -g lync-md
```

**2. Initialization**
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

**3. Version Control Setup**
Add `.lync/` to your `.gitignore` (this is the internal cache directory). The `lync-lock.yaml` should be committed—it ensures deterministic builds.
```gitignore
.lync/
```

**4. Synchronization**
Install the declared packages and generate the `lync-lock.yaml`:
```bash
lync sync
```

**5. Usage inside your Markdown**
```markdown
# My Awesome Prompt

According to the [Company Development Guidelines](lync:company-rules "@import:inline"):
(The compiler will replace this link with the raw text)
```

**6. Compilation (Simple One-to-One)**
Currently, Lync supports straightforward one-to-one compilation from your `.src.md` mapped to an output `.md` file:
```bash
lync build main.src.md -o main.md
```

### 🗂️ Advanced: Workspace Compilation

For larger projects, Lync supports automated batch compilation using a `lync-build.yaml` configuration. This allows you to construct complex routing rules using Glob patterns.

Create a `lync-build.yaml` in your workspace root:

```yaml
# Which files should the compiler scan?
includes:
  - "src/**/*.src.md"

# Where should unmatched files go by default?
outDir: "./dist"

# Advanced Routing Interceptors
routing:
  - match: "src/agents/*.src.md"
    dest: "./dist/agents/"
  - match: "src/prompts/core.src.md"
    dest: "./dist/core-prompt.md"
```

Then, simply execute the parameterless build command:
```bash
lync build
```

---

<a name="chinese"></a>
## 🇨🇳 中文

Lync 是一个专为大语言模型 (LLM) 时代设计的轻量级、去中心化 Markdown 包管理器与编译器。

随着 LLM 越来越多地将 Markdown 作为逻辑指令语言（例如 Prompt、System Instructions），Markdown 实际上已经演变为了**源代码**。Lync 为这些“源码”提供健全的依赖管理、内联组合和确定性构建机制，**且完全不依赖任何类似 npmjs 的中心化注册表**。

👉 [阅读完整的中文设计规范](DESIGN.zh.md)

### 🌟 核心设计

Lync 采用**向下兼容 (Graceful Degradation)** 的设计原则。编译指令被编码为标准 Markdown 链接的属性 (`[别名](lync:alias "@import:inline")`)，以确保未编译的源文件在通用阅读器（如 GitHub 或 Obsidian）中保持可读。

### 📦 核心特性

*   **去中心化包管理**: 直接通过目标 URL 拉取和安装 Markdown 文件，无需引入中心化注册表。
*   **基于别名的依赖管理**: 通过 `lync.yaml` 将 URL 绑定到本地别名（例如 `lync:coder-skill`），避免 URL 散落和命名冲突。
*   **确定性构建**: 通过 `lync-lock.yaml` 锁定远程文件的 SHA-256 哈希值，确保构建的确定性。
*   **双模式引入机制**:
    *   `@import:link` (链接重写): 将虚拟别名重写为本地相对物理路径，保留超链接结构。
    *   `@import:inline` (内联展开): 提取远程文本并替换当前引用，适用于组装大型 Prompt 上下文。

### 🚀 快速上手 (构想)

**1. 全局安装**
```bash
npm install -g lync-md
```

**2. 项目初始化**
在项目根目录创建 `lync.yaml` 声明依赖：

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

**3. 版本控制配置**
将 `.lync/` 加入 `.gitignore`（这是 Lync 的内部缓存目录）。`lync-lock.yaml` 应提交到版本控制——它确保构建的确定性。
```gitignore
.lync/
```

**4. 状态收敛 (同步)**
一键安装所有缺少的依赖，并生成 `lync-lock.yaml`：
```bash
lync sync
```

**5. Markdown 语法调用**
直接在你的 `.src.md` 文件里使用 `lync:{alias}` 协议：
```markdown
# 我的核心 Prompt

根据 [公司开发规范](lync:company-rules "@import:inline")：
(原始链接被移除，并在原位置插入完整文本内容)
```

**6. 执行编译（简单一对一）**
目前 Lync 支持直接的一对一编译，将你的 `.src.md` 源文件及其挂载的依赖，精准输出为干净的单体 `.md` 产物供 LLM 消费：
```bash
lync build main.src.md -o main.md
```

### 🗂️ 进阶用法：工作区批量编译

对于大型项目，Lync 支持通过 `lync-build.yaml` 配置文件进行自动化的批量编译。这允许你使用 Glob 模式构建复杂的路由和分发规则。

在你的项目根目录下创建 `lync-build.yaml`：

```yaml
# 编译器需要扫描哪些源文件？
includes:
  - "src/**/*.src.md"

# 默认的输出目录在哪？
outDir: "./dist"

# 高阶路由拦截器
routing:
  - match: "src/agents/*.src.md"
    dest: "./dist/agents/"
  - match: "src/prompts/core.src.md"
    dest: "./dist/core-prompt.md"
```

配置完毕后，只需无参数执行 build 指令即可自动完成全项目的批量组装：
```bash
lync build
```

---
