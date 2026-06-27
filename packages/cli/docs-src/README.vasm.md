---
vasm:
  compile:
    format: "doc"
    targetLangs: ["en", "zh-CN"]
---

<!-- lang:en -->
# @vasm/cli

`@vasm/cli` publishes the `vasmc` command. It is the AI-facing VASMC entrypoint: it compiles `.vasm.md` sources into clean Markdown outputs and, during `build`, emits `.vasmc/build-instructions.md` so the current AI can continue semantic work.

`vasmc` only performs deterministic work: dependency sync, AST assembly, language-block filtering, output writes, policy diagnostics, and follow-up work-order generation.

### Install

```bash
npm install -g @vasm/cli
```

### 1. Initialize A Project

```bash
vasmc init
```

Declare dependencies in `vasmc.yaml`:

```yaml
dependencies:
  company-rules: "https://example.com/guidelines.md"
  coder-skill:
    url: "https://example.com/coder-skill.md"
    dest: "./skills/coder.md"
```

Or register one from the command line:

```bash
vasmc add https://example.com/coder-skill.md --alias coder-skill --dest ./skills/coder.md
```

### 2. Sync And Lock

Add `.vasmc/` to `.gitignore`; it is an internal cache directory. Commit `vasmc-lock.yaml` so build inputs stay deterministic.

```gitignore
.vasmc/
```

Install missing dependencies and update the lockfile:

```bash
vasmc sync
```

Force refresh when needed:

```bash
vasmc update <alias>
vasmc update
```

### 3. AI Build

Compile one entry and generate follow-up instructions:

```bash
vasmc build main.vasm.md -o ./dist
```

Compile the workspace through `vasmc-build.yaml`:

```bash
vasmc build
```

`vasmc build` is the AI-side compiler entrypoint. It writes deterministic Markdown outputs, `.vasmc/build-report.yaml`, and `.vasmc/build-instructions.md`. If a target language is missing, `vasmc` does not call an external model; instead, it asks the current AI to handle Verify, Translate, Diff, Policy Review, Policy Gate, Project Review, and Tree-Shake tasks as needed.

### 4. Read The Work Orders

```bash
cat .vasmc/build-instructions.md
```

After every `vasmc build`, an AI editor should immediately read `.vasmc/build-instructions.md` and perform the listed action items in order. `.vasmc/build-report.yaml` records entries, outputs, manifest summaries, dependencies, `policy.status`, and policy diagnostics. If `ai.projectReview` is enabled, `.vasmc/project-review-context.yaml` lists files the AI can inspect for project-aware suggestions.

### 5. Other Deterministic Commands

```bash
vasmc graph main.vasm.md
vasmc seal my-prompt.md --alias my-custom-name
vasmc seal "prompts/**/*.md" --format prompt
```

`seal` injects VASM frontmatter into ordinary Markdown and renames files to `.vasm.md`. Use `--format doc` for human-facing documents such as README, HELP, and DESIGN. Use `--format prompt` for system prompts and skills consumed by AI.

### Workspace Builds

```yaml
includes:
  - "src/**/*.vasm.md"

output:
  dir: "./dist"

baseDir: "./src"

compile:
  doc:
    targetLangs: ["en", "zh-CN"]
  prompt:
    targetLangs: ["en"]

routing:
  - match: "src/agents/*.vasm.md"
    dest: "./dist/agents/"
```

CLI overrides are also supported:

```bash
vasmc build --out-dir ./doc --base-dir ./src
```
<!-- /lang -->

<!-- lang:zh-CN -->
# @vasm/cli

[CLI 使用说明](./fragments/cli.vasm.md "@import:inline")

[AI Build 工作流](./fragments/ai-build.vasm.md "@import:inline")
<!-- /lang -->
