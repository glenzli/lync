---
vasm:
  alias: vasmc-reference
  intent: "Document the stable VASM and VASMC protocol reference."
  compile:
    format: informational
    targetLangs: ["en", "zh-CN"]
---

# VASMC 协议参考

这是一份参考文档，覆盖 VASM source、workspace build config、build report actions、policy diagnostics 和 content signals。

## 1. 文件类型

| 文件 | 说明 |
| --- | --- |
| `*.vasm.md` | VASM source。包含 frontmatter、import、语言块和正文。 |
| `*.md` | 编译产物。由 VASMC 生成，通常不手工编辑。 |
| `vasmc.yaml` | 受管理依赖声明。支持直接 URL，也支持 catalog export。 |
| `vasmc-lock.yaml` | 依赖锁文件，应提交。 |
| `vasmc-build.yaml` | workspace build 配置。 |
| `vasmc-catalog.yaml` | 由 release catalog build 生成的可复用 artifact 索引。 |
| `.vasmc/build-report.yaml` | AI build 结构化报告。 |
| `.vasmc/project-review-context.yaml` | 项目感知审查索引。 |

## 2. VASM frontmatter

```yaml
---
vasm:
  alias: security-reviewer
  version: 1.0.0
  intent: "Assemble a security-focused code review prompt."
  compile:
    format: executable
    targetLangs: ["zh-CN"]
  dependencies:
    secure-rules: "https://example.com/security-rules.md"
    release-reviewer:
      catalog: "https://example.com/vasmc-catalog.yaml"
      export: releaseReviewer
---
```

### 字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `alias` | string | 本地别名。`vasmc add` 解析远程模块时可优先采用。 |
| `version` | string | 人类理解兼容性的版本信息；确定性锁定仍以 hash 为准。 |
| `intent` | string | 产物用途说明。会进入 build report，供 AI verify/integration review 使用。 |
| `compile` | object | 编译声明。 |
| `integration` | object | 仅用于 integrative guide 的适用对象声明。 |
| `dependencies` | object | 模块声明的受管理依赖。直接 URL 和 catalog export 都会进入 `vasmc.yaml` / `vasmc-lock.yaml`。 |

### 已移除字段

以下字段不再属于协议：`kind`、`scope`、`capabilities`、`activation`、`compatibility`、`trust`、`vision`、`fix`。

如果出现这些字段，manifest diagnostics 会报告：

```yaml
code: manifest.kind.removed
severity: error
```

## 3. `compile.format`

| format | 用途 | 输出行为 |
| --- | --- | --- |
| `informational` | README、HELP、DESIGN、知识文档、说明材料 | 多语种合并到一个 `.md` |
| `executable` | system prompt、skill、workflow instruction | 多语种时每个语种独立输出 |
| `integrative` | 指导一批 VASM 模块如何组合 | 生成一个展开后的组合指导 artifact，不做多语种拆分 |

Deprecated 兼容值：

| 旧值 | 新值 | 行为 |
| --- | --- | --- |
| `doc` | `informational` | 编译继续，但报告 deprecation diagnostic。 |
| `prompt` | `executable` | 编译继续，但报告 deprecation diagnostic。 |

其他值非法，例如 `source`：

```yaml
code: manifest.compile.format.invalid
severity: error
```

## 4. `integration.appliesTo`

```yaml
vasm:
  alias: reviewer-integration-guide
  compile:
    format: integrative
  integration:
    appliesTo:
      - vasm:security-reviewer
      - vasm/skills/reviewer/**/*.vasm.md
```

`integration.appliesTo` 只用于 `compile.format: integrative` 的文件。它声明这份 guide 应在整合哪些 executable 文件前被 AI 参考。

匹配规则：

- `vasm:<alias>` 匹配目标文件的 `vasm.alias`。
- 普通字符串按 source 路径或 output 路径做精确匹配或 glob 匹配。

这不是内容依赖。它不会把 integrative guide inline 到目标 prompt；guide 自身会编译成一个展开后的 artifact，并在 build report 中为命中的 executable entry 生成 `integration_guidance` action。

## 5. `compile.targetLangs`

```yaml
vasm:
  compile:
    targetLangs: ["en", "zh-CN"]
```

解析优先级：

1. 文件 frontmatter `compile.targetLangs`
2. `vasmc-build.yaml` 中按 format 配置的 `compile.<format>.targetLangs`
3. CLI `--target-langs`
4. 文件内 `<!-- lang:xx -->` 自动提取

工程项目通常把统一语种放在 `vasmc-build.yaml`。对外发布的独立模块可以在文件 frontmatter 中声明。

`integrative` 只产生一个组合指导 artifact，不产生语言变体；它会忽略 `compile.targetLangs`，并在 report diagnostics 中提示该字段无效用。

## 6. Import 指令

VASMC 把 import 写成标准 Markdown 链接 title，未编译时仍可读。

### Inline import

```markdown
[Rules](./fragments/rules.vasm.md "@import:inline")
```

行为：读取目标 source，编译后把内容插入当前位置。

### Link import

```markdown
[Rules](./fragments/rules.vasm.md "@import:link")
```

行为：保留链接边界，并把 `.vasm.md` source 路径重写成生成 `.md` 路径。

注意：link target 必须也被 build。否则生成链接可能指向不存在的文件。

### Alias import

```markdown
[Remote Rules](vasm:secure-rules "@import:inline")
```

`vasm:secure-rules` 来自 `vasmc.yaml` 和 `vasmc-lock.yaml`。

## 7. 语言块

```markdown
<!-- lang:en -->
English text.
<!-- /lang -->

<!-- lang:zh-CN -->
中文文本。
<!-- /lang -->
```

编译目标为 `en` 时只保留英文块；目标为 `zh-CN` 时只保留中文块。未包裹在语言块内的内容会进入所有目标语种。

## 8. `vasmc-build.yaml`

```yaml
includes:
  - "src/**/*.vasm.md"
excludes:
  - "src/fragments/**/*.vasm.md"

output:
  dir: "./dist"
  flat: false
  inPlace: false

baseDir: "./src"

compile:
  informational:
    targetLangs: ["en", "zh-CN"]
  executable:
    targetLangs: ["en"]

security:
  mode: review

ai:
  projectReview:
    mode: suggest
    include:
      - "README.md"
      - "src/**/*.vasm.md"

routing:
  - match: "src/skills/*.vasm.md"
    dest: "./skills/"

catalog:
  outDir: "./dist/vasm-catalog"
  exports:
    releaseReviewer:
      source: "src/skills/release-reviewer.vasm.md"
      targetLang: "zh-CN"
    releaseWorkflow:
      source: "src/integrations/release-workflow.vasm.md"
```

### 输出路径

默认输出路径：

```text
output.dir + path.relative(baseDir, source).replace(".vasm.md", ".md")
```

如果命中 `routing`，则 `routing.dest` 覆盖默认目录。

`routing.dest` 的解释规则：

- `.`、`./`、结尾带 `/` 的路径、无扩展名路径按目录处理，输出文件名来自 source basename。
- `./README.md` 这类带扩展名路径按精确文件目标处理。

例如 `match: "README.vasm.md"` + `dest: "."` 会输出 `README.md`；如果要明确写根目录 README，也可以写 `dest: "./README.md"`。

### Build flags

| flag | 行为 |
| --- | --- |
| `--force` | 忽略 build-state，重新构建未变化 entry。 |
| `--dry-run` / `--plan` | 只生成 report plan，不写产物、默认 report、project-review context、history cache 或 build-state。默认输出到 stdout。 |
| `--report-out <file>` | 显式把 build report 写到指定路径；可与 `--dry-run` 组合。 |

`--out-dir` 不是 dry-run。单文件 build 和 workspace build 都会先解析 workspace 配置；如果命中 `routing`，最终路径由 `routing.dest` 决定。

### Release catalog

`catalog` 是 release 约束，不影响普通 workspace routing。配置存在时，workspace `vasmc build` 会额外生成 `catalog.outDir/vasmc-catalog.yaml` 和导出 artifact。单文件 build 不生成 catalog。

`executable` 与 `informational` export 输出编译后的 Markdown artifact；`integrative` export 输出展开后的组合指导 artifact。catalog 阶段会消除内部 `@import:inline`，并把 source 中的 `integration.appliesTo` 解析为目标 artifact hash。source 不写 hash；hash 只出现在生成的 catalog 和 consumer lockfile 中。

生成的 `vasmc-catalog.yaml` 只保留协议版本和 exports，不写 package name 或 generated timestamp，减少无意义 diff：

```yaml
catalogVersion: 1
exports:
  releaseReviewer:
    name: release-reviewer
    version: "1.2.0"
    format: executable
    file: release-reviewer.zh-CN.md
    hash: sha256:...
  releaseWorkflow:
    name: release-workflow-guide
    version: "0.4.0"
    format: integrative
    file: release-workflow-guide.md
    hash: sha256:...
    appliesTo:
      - sha256:...
```

`hash` 是 artifact 内容 hash，是去中心化引用中的稳定身份。integrative export 的 `appliesTo` 同样使用目标 artifact hash，避免 consumer 依赖 producer 的内部 source 路径或 export 命名。`name` 和 `version` 来自 source frontmatter，只用于人类和 AI 判断语义兼容性。

外部引用 catalog export 时，在 `vasmc.yaml` 中声明 catalog dependency：

```yaml
dependencies:
  release-reviewer:
    catalog: "https://example.com/dist/vasm-catalog/vasmc-catalog.yaml"
    export: releaseReviewer
```

也可以使用命令写入同样的依赖声明并立即同步：

```bash
vasmc add --catalog https://example.com/dist/vasm-catalog/vasmc-catalog.yaml --export releaseReviewer --alias release-reviewer
```

`vasmc sync` 或 `vasmc add --catalog ...` 会读取 catalog、校验 artifact hash、把 artifact 写入本地 `.vasmc/` 或显式 `dest`，并在 `vasmc-lock.yaml` 中记录 `source: catalog`、`catalog`、`export`、`name`、`version`、`format`、`hash`、实际 artifact URL，以及 integrative export 的 `appliesTo`。之后 `@import` 仍然只通过 `vasm:<alias>` + lockfile 解析本地文件，不直接扫描远端仓库：

```markdown
[Release Reviewer](vasm:release-reviewer "@import:inline")
```

如果 consumer 同时锁定同一 catalog 中的 executable export 和 integrative export，且本地 executable entry 引用了这个 executable artifact，build report 会把匹配的 integrative artifact 放入 `integration_guidance.guides`。最终 prompt 不会自动 inline guide，AI 需要先读 guide 再做组合判断。

### `expand`

```bash
vasmc expand src/main.vasm.md --target-lang zh-CN --stdout
```

`expand` 只做确定性的 import 展开和语言块筛选，不走 workspace routing、build-state 或 build report。默认写 stdout；只有显式传 `--output <file>` 时才写文件。

### `security.mode`

| mode | 行为 |
| --- | --- |
| `review` | 报告风险，但不阻断输出。 |
| `enforce` | 当 executable entry 被 policy 标记为 `blocked` 时，不更新产物；integrative artifact 仍作为组合指导接受 policy review。 |

## 9. Build report

`.vasmc/build-report.yaml` 的核心结构：

```yaml
version: 2
mode: ai-build
runId: 20260702013627-a1b2c3
generatedAt: 2026-07-01T00:00:00.000Z
reportPath: .vasmc/build-report.yaml
projectReview:
  mode: suggest
  contextFile: .vasmc/project-review-context.yaml
entries:
  - source: src/skill.vasm.md
    output: dist/skill.md
    status: built
    format: executable
    targetLangs:
      - en
      - zh-CN
    compiledFiles:
      - dist/skill.en.md
    minimalTokenVariant:
      path: dist/skill.en.md
      lang: en
      tokens: 420
    policy:
      status: pass
      enforceable: true
    actions:
      - type: integration_guidance
        guides:
          - source: src/reviewer-integration.vasm.md
            appliesTo:
              - vasm:security-reviewer
      - type: verify
actions:
  - type: project_review
```

### Entry status

| status | 说明 |
| --- | --- |
| `built` | 已编译并写入输出。 |
| `skipped` | 增量缓存判断 source 未变化，跳过写入。 |
| `blocked` | policy gate 阻断输出。 |
| `planned` | dry-run 计划写入，但没有实际写文件。 |

### Policy status

| status | 说明 |
| --- | --- |
| `pass` | 未发现确定性 policy diagnostics。 |
| `review` | 确定性检查发现非阻断 diagnostics，需要人工或 AI 判断。 |
| `blocked` | 确定性检查发现阻断级风险。 |

## 10. Report actions

| action | 层级 | 说明 |
| --- | --- | --- |
| `verify` | entry | AI 检查产物是否符合 intent 和基础质量标准。 |
| `integration_review` | entry | AI 检查 integrative artifact 是否清楚表达组合边界。 |
| `integration_guidance` | entry | AI 在组合 executable 前读取匹配的 integrative guides。 |
| `translate` | entry | AI 按 `targets` 写目标语种产物。 |
| `refresh_translation` | entry | informational 输出复用旧目标语种段后，AI 检查并更新过期译文。 |
| `diff` | entry | AI 对比历史备份和新产物，总结语义变化。 |
| `tree_shake` | entry | 条件性 action；用户明确要求精简时才执行。 |
| `policy_review` | entry | AI 审查 review 级 diagnostics 和 content signals。 |
| `policy_gate` | entry | AI 解释 blocked 原因，并建议 source-level 修复。 |
| `project_review` | top-level | AI 结合项目上下文提出 source-level 建议。 |

## 11. Policy diagnostics

常见 code：

| code | source | gate | 说明 |
| --- | --- | --- | --- |
| `manifest.*.removed` | manifest | block | 使用了已移除 manifest 字段。 |
| `manifest.compile.format.invalid` | manifest | block | `compile.format` 非法。 |
| `manifest.compile.format.deprecated` | manifest | review | 使用了 deprecated format。 |
| `manifest.compile.targetLangs.integrative_ignored` | manifest | review | integrative 声明了不会生效的 `targetLangs`。 |
| `manifest.integration.appliesTo.invalid` | manifest | block | `integration.appliesTo` 不是字符串数组。 |
| `manifest.integration.appliesTo.non_integrative` | manifest | review | 非 integrative 文件声明了 `integration.appliesTo`。 |
| `policy.lockfile.missing` | lockfile | block | lockfile 指向的依赖不存在。 |
| `policy.lockfile.hash_mismatch` | lockfile | block | 本地依赖 hash 与 lockfile 不一致。 |
| `policy.format.informational_imports_active` | format | block | informational 引入 executable/integrative 内容。 |
| `policy.format.executable_imports_integrative` | format | review | executable 引入 integrative。 |
| `policy.format.integrative_imports_executable` | format | review | integrative 引入 executable。 |

## 12. Content signals

`policy.contentSignals` 是词面线索，不是确定性 diagnostics。它不会让 `policy.status` 变成 `blocked`，也不会被 `security.mode: enforce` 阻断。AI 应结合上下文判断 evidence 是 active instruction、prohibition、example 还是 documentation。

常见 code：

| code | stance | confidence | 说明 |
| --- | --- | --- | --- |
| `policy.content.prompt_override` | `unknown` / `prohibitive` | `medium` / `low` | 文本包含疑似覆盖上级指令的表达。 |
| `policy.content.concealment` | `unknown` / `prohibitive` | `medium` / `low` | 文本包含疑似隐藏行为的表达。 |
| `policy.content.secret_exfiltration` | `unknown` / `prohibitive` | `medium` / `low` | 文本同时出现密钥访问和外传表达。 |
| `policy.content.remote_execution` | `unknown` / `prohibitive` | `medium` / `low` | 文本同时出现远程获取和执行表达。 |

## 13. CLI 包边界

| 包 | 命令 | 说明 |
| --- | --- | --- |
| `@vasm/core` | 无 | 共享确定性核心。 |
| `@vasm/cli` | `vasmc` | AI build、依赖管理、结构化 report actions。 |
| `@vasm/console` | `vasm-console` | 面向人类的可选外部模型 lint/diff。 |

`@vasm/cli` 和 `@vasm/console` 都内置 core；发布时当前采用 fixed version group。
