---
vasm:
  compile:
    format: "doc"
    targetLangs: ["en", "zh-CN"]
---

<!-- lang:en -->
# @vasm/console

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
<!-- /lang -->

<!-- lang:zh-CN -->
# @vasm/console

[Console 使用说明](./fragments/console.vasm.md "@import:inline")
<!-- /lang -->
