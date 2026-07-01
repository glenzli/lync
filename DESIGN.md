# VASM Protocol And VASMC Compiler Design

[🌍 English](#en) | [🇨🇳 中文](#zh-cn)

***

<a name="en"></a>

## 🌍 English

VASMC is a Markdown prompt compiler for AI projects. It treats `.vasm.md` as source and generated `.md` as build output: source files hold structure, dependencies, intent, and output declarations; generated files are what humans or AI models read.

VASMC has a narrow core boundary: the compiler performs deterministic work only. When semantic judgment, translation, slimming, or project context review is needed, `vasmc build` writes tasks to `.vasmc/build-report.yaml` and the current AI editor continues from that report.

## 1. Design Goals

VASMC focuses on four problems:

1. **Separate source from output**: `.vasm.md` is the maintenance surface, and `.md` is the compiled result. Fixes should go back to source files, fragments, manifests, or `vasmc-build.yaml`.
2. **Modularize prompts**: `@import:inline` and `@import:link` compose local or remote Markdown modules without copy-paste.
3. **Classify output use**: `compile.format` distinguishes informational documents, executable prompts/skills, and integration guidance.
4. **Coordinate AI build work**: the deterministic compiler produces a structured report, and the current AI executes translation, verification, policy review, project review, and related actions.

VASMC is not a general sandbox and not an automatic prompt optimizer. It is a source-to-output build layer that gives AI editors a traceable input path and explicit follow-up tasks.

## 2. Package Boundaries

The monorepo currently publishes three packages:

| Package | Command | Responsibility |
| --- | --- | --- |
| `@vasm/core` | none | Deterministic compiler core, protocol validation, policy, graph traversal, build reports, and project review context. |
| `@vasm/cli` | `vasmc` | AI-facing CLI for build, sync, add, update, graph, and seal. |
| `@vasm/console` | `vasm-console` | Human-facing optional external-model tools such as lint and diff. |

`@vasm/cli` and `@vasm/console` both bundle core. The current release model uses one fixed version group to avoid protocol drift between core and the two entrypoints.

## 3. Source Files And Output Formats

The VASM manifest is intentionally small:

```yaml
vasm:
  alias: security-reviewer
  version: 1.0.0
  intent: "Assemble a security-focused code review prompt."
  compile:
    format: executable
    targetLangs: ["en", "zh-CN"]
  dependencies:
    secure-rules: "https://example.com/security-rules.md"
```

Stable fields:

| Field | Purpose |
| --- | --- |
| `alias` | Local or remote reference name. |
| `version` | Human compatibility metadata; deterministic locking still uses content hash. |
| `intent` | Describes what the output should accomplish and is copied into the AI build report. |
| `compile` | Declares output format and target languages. |
| `dependencies` | Declares remote dependencies for `vasmc add/sync`. |

`compile.format` accepts three current values:

| Format | Meaning | Output behavior |
| --- | --- | --- |
| `informational` | Documentation, knowledge, or explanatory material, not direct instructions | Multiple languages are merged into one `.md`. |
| `executable` | Prompt, skill, system instruction, or similar AI execution-surface content | Multiple languages become separate files, such as `skill.en.md`. |
| `integrative` | Guidance for composing multiple VASM modules | Reviewed as composition guidance, not used as the final prompt. |

Deprecated values are narrow: `doc` maps to `informational`, and `prompt` maps to `executable`, with diagnostics. Other format values are invalid.

Earlier descriptive fields such as `kind`, `scope`, `capabilities`, `activation`, `trust`, `vision`, and `fix` have been removed. Those natural-language fields were hard to define consistently and did not provide reliable validation.

## 4. Language Strategy

A source file may maintain only one language. `targetLangs` declares output requirements; it does not require the source to contain every target language.

In AI build mode:

* If source blocks already exist for target languages, VASMC filters them deterministically.
* If the source is Chinese-only and `targetLangs` contains `en` and `zh-CN`, VASMC writes the Chinese output first and adds a `translate` action for the missing English target.
* Missing languages for `informational` outputs are added to the same merged document.
* Missing languages for `executable` outputs are written to separate target files.

The compiler itself does not call a model. The current AI editor performs translation from the report action. This keeps the source maintenance surface compact while still allowing bilingual README/docs outputs.

## 5. Import Protocol

VASMC stores compile directives in standard Markdown link titles, so source files remain readable in ordinary Markdown tools:

```markdown
[Rules](./fragments/rules.vasm.md "@import:inline")
[Guide](./guide.vasm.md "@import:link")
[Remote Rules](vasm:secure-rules "@import:inline")
```

`@import:inline` expands the compiled target at the link position. Use it for shared rules, roles, output formats, and prompt fragments.

`@import:link` preserves the link boundary and rewrites `.vasm.md` source references to generated `.md` references.

Local relative imports are useful inside a repository. `vasm:alias` imports rely on `vasmc.yaml` and `vasmc-lock.yaml` and are better for remote or lockable dependencies.

The dependency graph must be acyclic. Circular inline imports fail the build.

## 6. Dependencies And Locking

`vasmc.yaml` declares remote dependencies:

```yaml
dependencies:
  company-rules: "https://example.com/guidelines.md"
  coder-skill:
    url: "https://example.com/coder-skill.md"
    dest: "./skills/coder.md"
```

`vasmc-lock.yaml` records resolved URLs, destinations, and content hashes. Commit it to version control so the team builds from the same inputs.

`.vasmc/` is the internal cache and report directory and is usually not committed.

## 7. AI Build Report

`vasmc build` is the AI-side compile entrypoint. It writes outputs and `.vasmc/build-report.yaml`:

```yaml
version: 2
mode: ai-build
entries:
  - source: src/skill.vasm.md
    status: built
    format: executable
    targetLangs: ["en", "zh-CN"]
    compiledFiles:
      - dist/skill.en.md
    actions:
      - type: verify
      - type: translate
      - type: tree_shake
actions:
  - type: project_review
```

Common actions:

| Action | Purpose |
| --- | --- |
| `verify` | Check executable output against `intent`. |
| `integration_review` | Check integrative composition boundaries. |
| `translate` | Fill missing target languages. |
| `diff` | Compare historical outputs and summarize semantic impact. |
| `tree_shake` | Analyze removable content when the user asks for slimming. |
| `policy_review` | Review non-blocking policy diagnostics and content signals. |
| `policy_gate` | Explain blocked diagnostics and suggest source changes. |
| `project_review` | Use project context to find stale or missing project facts. |

Generated `.md` files are review evidence by default, not the maintenance surface. The exception is a `translate` action that explicitly asks the AI to write target output.

## 8. Policy Gate

VASMC's policy gate is deterministic checking, not a runtime security boundary. It currently covers:

* manifest shape errors and removed fields
* invalid `compile.format` values
* missing lockfile entries or hash mismatches
* format-boundary errors, such as `informational` importing `executable` or `integrative`

Text that looks like prompt override, concealment, secret exfiltration, or remote-code execution is not treated as a blocking diagnostic. VASMC records it under `contentSignals`; the AI reviewer decides whether the evidence is an instruction, a prohibition, an example, or ordinary documentation.

Each entry includes:

```yaml
policy:
  status: pass     # pass | review | blocked
  enforceable: true
  contentSignals: # optional
    - code: policy.content.remote_execution
      stance: prohibitive
      confidence: low
```

`security.mode: review` reports risk without blocking. `security.mode: enforce` only uses deterministic blocked diagnostics to prevent `executable` and `integrative` outputs from being updated; `contentSignals` never trigger enforce blocking by themselves.

This does not defend against runtime prompt injection from user input, tool output, or RAG content. Those require host isolation, tool mediation, permission boundaries, or separate reviewers. VASMC only governs the input path you control.

## 9. Project Review

Projects can enable project context review in `vasmc-build.yaml`:

```yaml
ai:
  projectReview:
    mode: suggest
    include:
      - "README.md"
      - "docs/**/*.md"
      - "package.json"
      - "vasmc-build.yaml"
      - "skill-src/**/*.vasm.md"
```

When enabled, VASMC writes `.vasmc/project-review-context.yaml` and adds a top-level `project_review` action.

The compiler still does not call a model. The current AI editor reads the context index, build report, and relevant project files, then provides source-level suggestions or patch suggestions.

## 10. Bootstrap And vasm-expert

`skills/vasm-expert/SKILL.md` is generated from `skill-src/vasm-expert/vasmc-expert.vasm.md`. It inlines VASMC knowledge and AI build coordination rules so AI editors have a project-specific skill entrypoint.

The maintenance surface remains `skill-src/` and `docs-src/`. The generated skill is output for AI consumption and should not be hand-tuned.

## 11. Self-Evaluation Flow

`eval-src/` is a repository-local self-evaluation suite, not a public CLI contract. It tests VASMC's own compile capabilities:

* prompt/doc sample cases
* hard boundary checks
* expected-failure cases such as missing imports, circular imports, and invalid formats
* policy gate behavior
* link target existence
* Chinese AI-judge workflow
* one timestamped report under `self-eval-reports/`

The pattern is deterministic checks first, AI judgment second, with one auditable report.

## 12. Incremental Build

VASMC records entry and transitive dependency signatures in `vasmc-build-state.yaml`. If source, dependencies, target language set, and output files are unchanged, later builds mark the entry as skipped.

Skipped entries still appear in the build report, but product-level actions such as `verify`, `translate`, and `diff` are not repeated. This avoids asking AI to reprocess unchanged outputs.

`vasmc-build-state.yaml` is content-hash based and can be committed.

## 13. Current Boundaries

VASMC currently does not:

* call models from compiler core
* guarantee runtime resistance to user-input or tool-output prompt injection
* replace host application permission isolation
* treat natural-language trust/license/activation declarations as reliable security controls
* prove remote content trustworthy beyond making locked content reproducible

It provides a clearer input maintenance surface: what content is declared, how it is composed, where it is written, and which AI follow-up actions remain are all recorded in files and reports.

***

<a name="zh-cn"></a>

## 🇨🇳 中文

VASMC 是一个面向 AI 项目的 Markdown prompt 编译器。它把 `.vasm.md` 当作源文件，把生成的 `.md` 当作产物：源文件维护结构、依赖、用途声明和人类意图；产物提供给人类阅读或给 AI 读取。

VASMC 的核心边界很明确：编译器只做确定性工作，不内置模型调用。需要语义判断、翻译、裁剪或项目感知审查时，`vasmc build` 会把任务写入 `.vasmc/build-report.yaml`，由当前 AI 编辑器继续执行。

## 1. 设计目标

VASMC 主要解决四类问题：

1. **源与产物分离**：`.vasm.md` 是维护对象，`.md` 是编译结果。修复应回到源文件、fragment、manifest 或 `vasmc-build.yaml`。
2. **Prompt 模块化**：通过 `@import:inline` 和 `@import:link` 组合本地或远程 Markdown 模块，减少复制粘贴。
3. **输出用途分类**：通过 `compile.format` 区分信息文档、可执行 prompt/skill，以及组合指导。
4. **AI build 协作**：确定性编译器生成结构化 report，当前 AI 按 report actions 完成翻译、校验、policy review、project review 等后续任务。

这不是通用安全沙箱，也不是自动 prompt 优化器。VASMC 更接近一个 source-to-output 的构建层，为 AI 编辑器提供可追踪的输入路径和明确的后续任务。

## 2. 包边界

当前 monorepo 拆成三个发布包：

| 包 | 命令 | 职责 |
| --- | --- | --- |
| `@vasm/core` | 无 | 确定性编译核心、协议校验、policy、依赖图、build report、project review context。 |
| `@vasm/cli` | `vasmc` | 面向 AI 编辑器和自动化流程的 CLI：build、sync、add、update、graph、seal。 |
| `@vasm/console` | `vasm-console` | 面向人类的可选外部模型工具，例如 lint 和 diff。 |

`@vasm/cli` 与 `@vasm/console` 都内置 core。当前发布采用统一版本组，避免 core 与两个入口之间出现协议漂移。

## 3. 源文件与输出格式

VASM manifest 当前保持小而稳定：

```yaml
vasm:
  alias: security-reviewer
  version: 1.0.0
  intent: "Assemble a security-focused code review prompt."
  compile:
    format: executable
    targetLangs: ["en", "zh-CN"]
  dependencies:
    secure-rules: "https://example.com/security-rules.md"
```

稳定字段包括：

| 字段 | 作用 |
| --- | --- |
| `alias` | 本地或远程引用时使用的别名。 |
| `version` | 给人类判断兼容性的元数据；确定性锁定仍以内容 hash 为准。 |
| `intent` | 描述产物应达成的用途，会进入 AI build report。 |
| `compile` | 声明输出格式和目标语种。 |
| `dependencies` | 声明远程依赖，供 `vasmc add/sync` 解析。 |

`compile.format` 只接受三类当前格式：

| 格式 | 含义 | 输出行为 |
| --- | --- | --- |
| `informational` | 文档、知识、说明材料，不作为直接执行指令 | 多语种合并到同一个 `.md`。 |
| `executable` | prompt、skill、system instruction 等会作为 AI 指令读取的内容 | 多语种输出为独立文件，例如 `skill.en.md`。 |
| `integrative` | 指导一组 VASM 模块如何组合 | 作为组合指导审查，不直接当作最终 prompt。 |

旧值 `doc` 会映射为 `informational`，`prompt` 会映射为 `executable`，并输出 deprecated diagnostics。其他格式值非法。

早期尝试过的 `kind`、`scope`、`capabilities`、`activation`、`trust`、`vision`、`fix` 等字段已经移除。这些自然语言说明字段很难稳定定义，容易占用 AI 注意力，却不能提供可靠校验。

## 4. 多语种策略

源文件可以只维护一个语种。`targetLangs` 声明的是目标产物需求，不要求 source 本身同时维护所有语种。

在 AI build 模式下：

* 如果源文件已有目标语种块，VASMC 确定性过滤对应语言块。
* 如果源文件只有中文，但 `targetLangs` 包含 `en` 和 `zh-CN`，VASMC 会先生成已有中文产物，并在 `.vasmc/build-report.yaml` 中加入 `translate` action。
* `informational` 的缺失语种翻译会写回同一个合并文档。
* `executable` 的缺失语种翻译会写入独立目标文件。

编译器本身不调用模型。翻译由当前 AI 编辑器按 report action 完成。这样可以保持 source 维护面简洁，同时保留双语 README/docs 这类发布产物。

## 5. Import 协议

VASMC 把编译指令放在标准 Markdown link title 中，源文件在普通 Markdown 阅读器中仍然可读：

```markdown
[Rules](./fragments/rules.vasm.md "@import:inline")
[Guide](./guide.vasm.md "@import:link")
[Remote Rules](vasm:secure-rules "@import:inline")
```

`@import:inline` 会把目标文件编译后的内容展开到当前位置。适合共享规则、角色、输出格式和 prompt fragment。

`@import:link` 会保留链接结构，并把 `.vasm.md` source 引用重写为生成态 `.md` 引用。适合保留文档边界。

本地相对 import 适合仓库内部协作。`vasm:alias` 依赖 `vasmc.yaml` 和 `vasmc-lock.yaml`，适合远程模块或可锁定依赖。

依赖图必须无环。inline import 发现循环时会失败。

## 6. 依赖与锁定

`vasmc.yaml` 声明远程依赖：

```yaml
dependencies:
  company-rules: "https://example.com/guidelines.md"
  coder-skill:
    url: "https://example.com/coder-skill.md"
    dest: "./skills/coder.md"
```

`vasmc-lock.yaml` 记录解析后的 URL、dest 和内容 hash，应提交到版本控制。它保证团队成员在同一 lockfile 下得到一致输入。

`.vasmc/` 是内部缓存和 report 目录，通常不提交。

## 7. AI Build Report

`vasmc build` 是 AI 侧编译入口。它会生成产物，并写入 `.vasmc/build-report.yaml`：

```yaml
version: 2
mode: ai-build
entries:
  - source: src/skill.vasm.md
    status: built
    format: executable
    targetLangs: ["en", "zh-CN"]
    compiledFiles:
      - dist/skill.en.md
    actions:
      - type: verify
      - type: translate
      - type: tree_shake
actions:
  - type: project_review
```

常见 action：

| action | 作用 |
| --- | --- |
| `verify` | 检查 executable 产物是否符合 `intent`。 |
| `integration_review` | 检查 integrative 产物的组合边界是否清楚。 |
| `translate` | 补齐缺失目标语种。 |
| `diff` | 对比历史产物并说明语义影响。 |
| `tree_shake` | 在用户明确要求优化/压缩时分析可裁剪内容。 |
| `policy_review` | 审查 review 级 policy diagnostics 和 content signals。 |
| `policy_gate` | 解释 blocked diagnostics，并建议修改源文件。 |
| `project_review` | 结合项目上下文审查 prompt/docs 是否过期或缺项。 |

生成态 `.md` 默认是审查证据，不是维护对象。例外是 `translate` action 明确要求补齐目标产物时，AI 可以写对应生成文件。

## 8. Policy Gate

VASMC 的 policy gate 是确定性检查，不是运行时安全边界。它当前覆盖：

* manifest 结构错误和已移除字段。
* `compile.format` 非法值。
* lockfile 缺失或 hash 不一致。
* `informational` 导入 `executable` / `integrative` 的格式边界错误。

内容文本中的 prompt override、隐藏行为、密钥外传、下载执行远程代码等词面风险不会作为阻断级 diagnostics。VASMC 只把它们写入 `contentSignals`，由 AI 结合上下文判断它是在发出指令、禁止风险、举例，还是普通说明。

每个 entry 都有：

```yaml
policy:
  status: pass     # pass | review | blocked
  enforceable: true
  contentSignals: # optional
    - code: policy.content.remote_execution
      stance: prohibitive
      confidence: low
```

`security.mode: review` 只报告风险。`security.mode: enforce` 只根据确定性 blocked diagnostics 阻止 `executable` 和 `integrative` 产物被更新，不会因为 `contentSignals` 阻断输出。

这不能防御用户输入、工具输出或 RAG 内容中的运行时 prompt injection。那些需要宿主环境、工具代理、权限隔离或独立 reviewer 处理。VASMC 只负责你能控制的输入路径。

## 9. Project Review

项目可以在 `vasmc-build.yaml` 中开启项目感知审查：

```yaml
ai:
  projectReview:
    mode: suggest
    include:
      - "README.md"
      - "docs/**/*.md"
      - "package.json"
      - "vasmc-build.yaml"
      - "skill-src/**/*.vasm.md"
```

开启后，VASMC 写入 `.vasmc/project-review-context.yaml`，并在 build report 顶层加入 `project_review` action。

这仍然不是编译器调用模型。当前 AI 编辑器读取 context index、build report 和相关项目文件后，给出源文件级建议或 patch 建议。

## 10. 自举与 vasm-expert

仓库内的 `skills/vasm-expert/SKILL.md` 由 `skill-src/vasm-expert/vasmc-expert.vasm.md` 编译生成。它内联 VASMC 知识手册和 AI build 协调规程，作为 AI 编辑器理解本仓库的技能入口。

这一流程的维护面仍在 `skill-src/` 和 `docs-src/`。生成的 `skills/vasm-expert/SKILL.md` 是给 AI 读取的产物，不应手工微调。

## 11. 自评估流程

`eval-src/` 是仓库本地的自评估集合，不是公开 CLI contract。它用于测试 VASMC 自身的编译能力：

* prompt/doc 样本 case。
* hard boundary checks。
* 预期失败 case，例如缺失 import、循环 import、非法 format。
* policy gate 行为检查。
* 链接目标存在性检查。
* AI judge 使用的中文评审流程。
* 单份带时间戳的报告输出到 `self-eval-reports/`。

这个流程体现当前设计取向：先用确定性检查建立边界，再把语义判断交给 AI，并留下可审计报告。

## 12. 增量构建

VASMC 使用 `vasmc-build-state.yaml` 记录 entry 和传递依赖的内容签名。若 source、依赖、目标语种集合和产物文件都未变化，后续 build 会标记为 skipped。

skipped entry 仍会进入 build report，但不会重复生成 verify/translate/diff 等产物级 action。这样可以避免 AI 在无变化产物上重复工作。

`vasmc-build-state.yaml` 基于内容 hash，适合提交到版本控制。

## 13. 当前边界

VASMC 当前不做这些事：

* 不在 compiler core 内调用模型。
* 不保证 prompt 在运行时不会被用户输入或工具输出越狱。
* 不替代宿主应用的权限隔离。
* 不把自然语言的 trust/license/activation 声明当成可靠安全机制。
* 不保证远程内容本身可信，只保证锁定后的内容可复现。

它提供的是一个更清晰的输入维护面：哪些内容被声明、如何组合、输出到哪里、还需要 AI 做哪些后续动作，都以文件和 report 的形式留下来。
