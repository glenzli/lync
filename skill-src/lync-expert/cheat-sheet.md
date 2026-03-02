# Lync 编译器速查表

## 核心语法与引入协议

### 1. 引入语法

`[链接文本](lync:alias "@lync-directive")`

- **链接模式 (`@import:link`)**：将 `lync:alias` URI 替换为目标文件的本地相对物理路径，保留超链接结构。
- **内联模式 (`@import:inline`)**：读取目标文件的原始文本内容，并将整个超链接替换为此内容。主要用于组装大型上下文。

### 2. 本地相对引入
直接使用原生 Markdown 相对路径进行同项目内的引入。
`[引入本地角色](./prompts/persona.lync.md "@import:inline")`

### 3. 多语种编译区块
在同一个 `.lync.md` 文件中使用 HTML 注释风格的标签编写多语言内容块。
```markdown
<!-- lang:en -->
English explanation block here.
<!-- /lang -->
<!-- lang:zh-CN -->
中文解释语段在这里。
<!-- /lang -->
```

---

## 🛠️ CLI 命令与 Agent 编排

- `lync init`：在当前目录下生成默认的 `lync-build.yaml` 配置。
- `lync sync`：安装 `lync.yaml` 中声明的所有远程依赖，并生成 `lync-lock.yaml` 锁定文件以确保确定性构建。
- `lync add <url>`：下载一个远程依赖并将其别名自动注册到 `lync.yaml`。
- `lync build <file>`：将目标 `.lync.md` 文件编译为干净、扁平的 `.md` 产物。
- `lync build <file> --target-langs zh-CN,ja`：将文件交叉编译到多个目标语种。
- `lync build <file> --verify`：在本地使用 LLM 对最终组装的指令逻辑进行语义校验。
- `lync build <file> --verify-continue-on-error`：即使 LLM 校验 API 调用失败也继续编译。
- `lync build <file> --agent`：**LLM 自治驱动模式**。绕过所有 Lync 内部的 LLM API 调用（翻译、校验）以节省 Token。Lync 仅执行确定性文件合并/AST 遍历，并输出编排计划 (`.lync/agent-instructions.md`) 供外部 AI 编辑器执行。
- `lync build <file> --diff`：编译文件并使用 LLM 对新旧编译产物进行语义对比分析。
- `lync graph <file>`：静态分析 AST 并打印所有嵌套 `@import` 依赖的可视化 ASCII 树。
- `lync seal <patterns...>`：向标准 Markdown 文件注入 `lync` 元数据（版本号、别名）和多语言标签，将其升级为 Lync 模块。

---

## 🧠 核心设计理念
1. **扁平化解析**：依赖关系强制扁平化命名空间，杜绝多层嵌套版本。深层嵌套会导致主流 LLM 严重的注意力缺失（幻觉），应当避免。
2. **确定性构建**：使用 `lync-lock.yaml` 配合 SHA-256 哈希作为依赖的唯一可信来源。
3. **拒绝模板引擎**：使用 AST 级别解析而非字符串替换，即使在编译前也保持 Markdown 的原生可读性。
