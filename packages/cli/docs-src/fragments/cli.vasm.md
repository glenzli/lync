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

---

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
