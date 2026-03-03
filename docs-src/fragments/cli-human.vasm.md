<a name="cli-human"></a>
## 🛠️ CLI 使用方法与编译构建

**1. 初始化项目**
你可以使用以下命令在当前目录快速生成一份默认的 `vasmc-build.yaml` 配置文件模板：
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

*或者直接使用命令行：*
```bash
vasmc add https://example.com/coder-skill.md --alias coder-skill --dest ./skills/coder.md
```

**2. 版本控制配置**
将 `.vasmc/` 加入 `.gitignore`（这是 VASMC 的内部缓存目录）。`vasmc-lock.yaml` 应提交到版本控制——它确保构建的确定性。
```gitignore
.vasmc/
```

**3. 状态收敛 (同步)**
一键安装所有缺少的依赖，并生成 `vasmc-lock.yaml`：
```bash
vasmc sync
```

**4. 执行编译（简单一对一）**
目前 VASMC 支持直接的一对一编译，将你的 `.vasm.md` 源文件及其挂载的依赖，精准输出为干净的单体 `.md` 产物供 LLM 消费（`-o` 指定输出目录）：
```bash
vasmc build main.vasm.md -o ./dist
```

**5. 语义校验 (LLM 驱动)**
编译完成后，可使用独立的 `vasmc lint` 命令对产物进行语义冲突检测：
```bash
vasmc build main.vasm.md
vasmc lint main.md --model gpt-4o
```
*需要在环境变量中配置 `OPENAI_API_KEY`，或通过 `.vasmrc` 配置自定义大模型节点。*

**6. 快捷封装 (Auto-Frontmatter)**
> 💡 **技巧：** 你可以运行以下命令，将普通的 Markdown 文件自动转换为 VASM 模块：
> ```bash
> vasmc seal my-prompt.md --alias my-custom-name
> ```
> *支持 Glob 模式批量操作：`vasmc seal "prompts/**/*.md"`*
> *这个命令会自动从文件名或路径中推断一个别名，在顶部注入 Frontmatter，并自动将文件重命名为 `.vasm.md`。*

---

<a name="workspace"></a>
### 🗂️ 进阶用法：工作区批量编译
对于大型项目，VASMC 支持通过 `vasmc-build.yaml` 配置文件进行自动化的批量编译。

在你的项目根目录下创建 `vasmc-build.yaml`：

```yaml
# 编译器需要扫描哪些源文件？
includes:
  - "src/**/*.vasm.md"

# 编译产物输出到哪里？
output:
  dir: "./dist"

# 剔除映射前缀目录
baseDir: "./src"

# 交叉编译目标语种（按输出格式分别配置）
compile:
  doc:                          # 文档格式：多语言合并
    targetLangs: ["en", "zh-CN"]
  exec:                         # 可执行指令格式：单语言输出
    targetLangs: ["en"]

# [高级] 路由拦截器
routing:
  - match: "src/agents/*.vasm.md"
    dest: "./dist/agents/"
```

### [高级] 全局配置 (.vasmrc)
VASMC 现在支持在用户的全局目录 (`~/.vasmrc`) 或项目根目录 (`./.vasmrc`，**请记得将其加入 `.gitignore`**) 中创建独立的 `.vasmrc` 配置文件配置自定义大模型节点。
```yaml
lang: "zh-CN" # VASMC 的全局交互日志和大模型输出语言
llm:
  baseURL: "https://api.deepseek.com/v1"
  apiKey: "your-custom-api-key"
  model: "deepseek-chat"
```

随后，只需执行无参数补全的构建命令即可：
```bash
vasmc build
```

*同时支持 CLI 临时覆盖：*
```bash
vasmc build --out-dir ./doc --base-dir ./src
```
