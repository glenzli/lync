---
vasm:
  compile:
    format: "informational"
    targetLangs: ["en", "zh-CN"]
---

<!-- lang:en -->
# @vasm/cli

`@vasm/cli` publishes the `vasmc` command. It is the AI-facing VASMC entrypoint: it compiles `.vasm.md` sources into clean Markdown outputs and, during `build`, emits structured `.vasmc/build-report.yaml` actions so the active VASM skill can continue semantic work.

`vasmc` only performs deterministic work: dependency sync, AST assembly, language-block filtering, output writes, policy diagnostics, content signal collection, and report action generation.

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
  release-reviewer:
    catalog: "https://example.com/dist/vasm-catalog/vasmc-catalog.yaml"
    export: releaseReviewer
```

Or register one from the command line:

```bash
vasmc add https://example.com/coder-skill.md --alias coder-skill --dest ./skills/coder.md
vasmc add --catalog https://example.com/dist/vasm-catalog/vasmc-catalog.yaml --export releaseReviewer --alias release-reviewer
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

Catalog dependencies can be written in `vasmc.yaml` or registered with `vasmc add --catalog <catalog> --export <key>`. VASMC reads `vasmc-catalog.yaml`, then locks the selected artifact by its `file` and `hash`. `@import` still uses `vasm:<alias>` and does not scan remote catalogs or repositories.

Force refresh when needed:

```bash
vasmc update <alias>
vasmc update
```

### 3. AI Build

Compile one entry and generate a structured build report:

```bash
vasmc build main.vasm.md -o ./dist
```

Compile the workspace through `vasmc-build.yaml`:

```bash
vasmc build
```

`vasmc build` is the AI-side compiler entrypoint. It writes deterministic Markdown outputs and `.vasmc/build-report.yaml`. If a target language is missing, `vasmc` does not call an external model; instead, it records actions for the current AI to handle Verify, Integration Guidance, Translate, Refresh Translation, Diff, Policy Review, Policy Gate, Project Review, and Tree-Shake tasks as needed. For `informational` outputs, existing target-language sections can be preserved and marked for refresh review instead of being dropped.

Useful build controls:

```bash
vasmc build --dry-run
vasmc build main.vasm.md --dry-run --force
vasmc build --dry-run --report-out .vasmc/plan.yaml
vasmc build --force
```

`--dry-run` emits a YAML report plan to stdout and does not write compiled outputs, `.vasmc/build-report.yaml`, project-review context, history cache, or build-state. `--report-out` explicitly writes that report plan to a chosen file. `--force` ignores build-state and rebuilds unchanged entries.

For a pure expanded draft without workspace routing or report actions:

```bash
vasmc expand main.vasm.md --target-lang zh-CN --stdout
```

`expand` performs deterministic import expansion and language-block filtering only. It does not update outputs, build-state, or build reports unless `--output` is explicitly provided.

### 4. Read The Build Report

```bash
cat .vasmc/build-report.yaml
```

After every `vasmc build`, an AI editor should immediately read `.vasmc/build-report.yaml`; the VASM skill interprets `entries[].actions` and top-level `actions`. The report records entries, outputs, compiled files, minimal-token variants, manifest summaries, dependencies, integrative guide artifacts, `policy.status`, policy diagnostics, and content signals. If `ai.projectReview` is enabled, `.vasmc/project-review-context.yaml` lists files the AI can inspect for project-aware suggestions.

### 5. Other Deterministic Commands

```bash
vasmc graph main.vasm.md
vasmc seal my-prompt.md --alias my-custom-name
vasmc seal "prompts/**/*.md" --format executable
```

`seal` injects VASM frontmatter into ordinary Markdown and renames files to `.vasm.md`. Use `--format informational` for documents such as README, HELP, and DESIGN. Use `--format executable` for system prompts and skills consumed by AI. Use `--format integrative` for composition guidance that should compile into a guide artifact.

### Workspace Builds

```yaml
includes:
  - "src/**/*.vasm.md"

output:
  dir: "./dist"

baseDir: "./src"

compile:
  informational:
    targetLangs: ["en", "zh-CN"]
  executable:
    targetLangs: ["en"]

routing:
  - match: "src/agents/*.vasm.md"
    dest: "./dist/agents/"

catalog:
  outDir: "./dist/vasm-catalog"
  exports:
    mainSkill:
      source: "src/agents/main-skill.vasm.md"
      targetLang: "en"
    mainWorkflow:
      source: "src/integrations/main-workflow.vasm.md"
```

CLI overrides are also supported:

```bash
vasmc build --out-dir ./doc --base-dir ./src
vasmc build --security enforce
```

When `catalog.exports` is configured, workspace builds also emit `catalog.outDir/vasmc-catalog.yaml` and exported artifacts. The catalog is a release index: `executable`/`informational` exports are compiled Markdown, `integrative` exports are expanded guidance artifacts, and catalog `appliesTo` relationships are emitted as target artifact hashes. External consumers should lock artifacts through `dependencies.<alias>.catalog` / `export` before importing them.
<!-- /lang -->

<!-- lang:zh-CN -->
# @vasm/cli

[CLI 使用说明](./fragments/cli.vasm.md "@import:inline")

[AI Build 工作流](./fragments/ai-build.vasm.md "@import:inline")
<!-- /lang -->
