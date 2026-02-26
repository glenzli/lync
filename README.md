# Lync 

🌍 [English](#english) | 🇨🇳 [中文](#chinese)

---

<a name="english"></a>
## 🌍 English

Lync is a lightweight, decentralized package manager and compiler designed specifically for Markdown files in the era of Large Language Models (LLMs). 

As LLMs increasingly use Markdown for logic control (e.g., Prompts, System Instructions), Markdown has effectively evolved into **source code**. Lync treats Markdown as such, providing robust mechanisms for dependency management, inline composition, and deterministic builds—**all without relying on any centralized registries like npmjs.**

👉 [Read the Full English Design Spec](DESIGN.en.md)

### 🌟 Core Philosophy

The core philosophy of Lync is **Graceful Degradation**. Lync-enabled Markdown files must remain fully readable, clickable standard documents in generic viewers (like GitHub or Obsidian) even without the compiler. 

All compilation directives are elegantly hidden within standard Markdown link attributes (`[Title](lync:alias "@import:inline")`).

### 📦 Features

*   **Decentralized Package Management**: Install remote Markdown files purely via their URLs. No central registry required.
*   **Alias-Driven Architecture**: Use `lync.yaml` to map long URLs to short, local Aliases (e.g., `lync:coder-skill`). Say goodbye to URL scattering and naming collisions.
*   **Deterministic Builds**: The `lync-lock.yaml` mechanism ensures 100% reproducible environments by locking the SHA-256 hashes of all remote files.
*   **Two Import Modes**:
    *   `@import:link`: Rewrites virtual aliases to local physical paths, perfect for building structured Knowledge Bases.
    *   `@import:inline`: Flatten and inject remote text in-place, perfectly suited for assembling massive monolythic LLM Prompts.

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

**3. Synchronization**
Install the declared packages and generate the `lync-lock.yaml`:
```bash
lync sync
```

**4. Usage inside your Markdown**
```markdown
# My Awesome Prompt

According to the [Company Development Guidelines](lync:company-rules "@import:inline"):
(The compiler will expand the rules here)
```

**5. Compilation**
```bash
lync build main.src.md -o main.md
```

---

<a name="chinese"></a>
## 🇨🇳 中文

Lync 是一个专为大语言模型 (LLM) 时代设计的轻量级、去中心化 Markdown 包管理器与编译器。

随着 LLM 越来越多地将 Markdown 作为逻辑指令语言（例如 Prompt、System Instructions），Markdown 实际上已经演变为了**源代码**。Lync 为这些“源码”提供健全的依赖管理、内联组合和确定性构建机制，**且完全不依赖任何类似 npmjs 的中心化注册表**。

👉 [阅读完整的中文设计规范](DESIGN.zh.md)

### 🌟 核心哲学

Lync 的核心理念是**合法降级 (Graceful Degradation)**。为了最大程度提升人类阅读体验，保持文档纯净，所有 Lync 的编译指令都被隐藏在标准 Markdown 链接的属性中 (`[别名](lync:alias "@import:inline")`)。即使没有经过编译，文件依然能在 GitHub 或 Obsidian 里当作普通的超链接文章来阅读。

### 📦 核心特性

*   **去中心化包管理**: 直接通过目标 URL 拉取和安装 Markdown 文件。不需要发布任何 Npm 包。
*   **别名防碰撞架构**: 通过统一的 `lync.yaml` 将冗长的 URL 绑定到简短本地别名（例如 `lync:coder-skill`）。告别 URL 散落和命名冲突。
*   **确定性构建**: 借助 `lync-lock.yaml`，所有的远端文件都会被锁定 SHA-256 Hash 值，保证在任何机器上的拉取都是 100% 确定且防篡改的。
*   **双模式路由引擎**:
    *   `@import:link` (链接路由): 将虚拟别名重写为真实的本地相对路径，适合构建结构化的知识库系统。
    *   `@import:inline` (内联展开): 提取远端文本在当前位置原地平铺替换，完美契合 LLM 庞大单体 Prompt 的组装需求。

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

**3. 状态收敛 (同步)**
一键安装所有缺少的依赖，并生成 `lync-lock.yaml`：
```bash
lync sync
```

**4. Markdown 语法调用**
直接在你的 `.src.md` 文件里使用 `lync:{alias}` 协议：
```markdown
# 我的核心 Prompt

根据 [公司开发规范](lync:company-rules "@import:inline")：
(编译器会将规范纯文本全部平摊粘贴在这里)
```

**5. 执行编译**
输出完美的纯净 `.md` 产物供 LLM 消费：
```bash
lync build main.src.md -o main.md
```
