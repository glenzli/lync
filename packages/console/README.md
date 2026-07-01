# @vasm/console

[🌍 English](#en) | [🇨🇳 中文](#zh-cn)

---

<a name="en"></a>

## 🌍 English

`@vasm/console` publishes the `vasm-console` command. It is the human-facing VASMC console for optional external-model assistance. It reuses the deterministic compiler path, but adds semantic tools that require an LLM.

It is not the AI compiler entrypoint. AI editors should use `@vasm/cli` and `vasmc build`; semantic tools such as `lint` and `diff` live only in the console package.

### Install

```bash
npm install -g @vasm/console
```

### Semantic Lint

After compiling a source, run LLM-assisted semantic conflict checks against the output:

```bash
vasmc build main.vasm.md
vasm-console lint main.md --model gpt-4o
```

`lint` reviews four categories: instruction conflicts, split persona, logical redundancy, and system-destruction risk. It is outside the deterministic compile chain and does not modify source or output files when it fails.

### Semantic Diff

```bash
vasm-console diff new.md old.md --model gpt-4o
```

`diff` explains semantic and structural impact between compiled outputs instead of only reporting textual changes.

### External Model Configuration

`vasm-console` can read OpenAI-compatible model settings from environment variables or `.vasmrc`. A `.vasmrc` file can live in the user home directory or project root; project-local `.vasmrc` files should be added to `.gitignore`.

```yaml
lang: "en"
llm:
  baseURL: "https://api.deepseek.com/v1"
  apiKey: "your-custom-api-key"
  model: "deepseek-chat"
```

Equivalent environment variables:

```bash
VASM_LLM_API_KEY=...
VASM_LLM_BASE_URL=...
VASM_LLM_MODEL=...
```

`lang` also affects VASMC interactive log language. `llm` is only read by the optional external-model tools in `@vasm/console`.

---

<a name="zh-cn"></a>

## 🇨🇳 中文

<a name="console-zh-cn"></a>

## 🧭 @vasm/console：人用控制台与可选外部模型工具

`@vasm/console` 提供 `vasm-console` 命令，面向人类开发者使用。它复用确定性编译代码，但额外提供需要外部模型的语义检查命令。

### 安装

```bash
npm install -g @vasm/console
```

### 语义校验

编译完成后，可以用 LLM 检查产物中的语义冲突：

```bash
vasmc build main.vasm.md
vasm-console lint main.md --model gpt-4o
```

`lint` 会检查四类问题：指令冲突、人格分裂、逻辑冗余和系统破坏风险。它不属于确定性编译链，失败时不会改变源文件或产物文件。

### 语义 Diff

```bash
vasm-console diff new.md old.md --model gpt-4o
```

`diff` 会解释两个编译产物之间的语义和结构影响，而不是只报告文本差异。

### 外部模型配置

`vasm-console` 可以通过环境变量或 `.vasmrc` 配置 OpenAI-compatible 节点。`.vasmrc` 可以放在用户目录或项目根目录；项目内 `.vasmrc` 应加入 `.gitignore`。

```yaml
lang: "zh-CN"
llm:
  baseURL: "https://api.deepseek.com/v1"
  apiKey: "your-custom-api-key"
  model: "deepseek-chat"
```

等价环境变量：

```bash
VASM_LLM_API_KEY=...
VASM_LLM_BASE_URL=...
VASM_LLM_MODEL=...
```

`lang` 也会影响 VASMC 的交互日志语言；`llm` 只被 `@vasm/console` 的外部模型工具读取。
