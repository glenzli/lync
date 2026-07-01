<a name="cli-ai-build"></a>
## 🤖 AI Build 工作流

使用 AI 编辑器处理 VASM 项目时，VASMC 只负责确定性组装；语义校验、翻译、Diff 和裁剪由当前 AI 完成。当前 AI 助手应使用 AI 侧 build 执行编译：

```bash
vasmc build [file]
```

> **AI 编辑器始终使用 `vasmc build`。**
> 在 `@vasm/cli` 中，`build` 会同时产出确定性 Markdown 和 `.vasmc/build-report.yaml` 结构化 actions。

在该模式下，VASMC 执行 AST 静态组装，并在项目隐藏目录输出结构化报告：

**`.vasmc/build-report.yaml`**

**`.vasmc/project-review-context.yaml`**（仅在 `ai.projectReview` 开启时生成）

### AI 助手操作规程

每当你执行了 `vasmc build` 命令后，**立即读取 `.vasmc/build-report.yaml`**，并按 `entries[].actions` 与顶层 `actions` 顺序执行以下任务（具体步骤由编译器按需记录）：

1. **Semantic Verify**：当 action 为 `verify` 时，读取 `minimalTokenVariant.path`，检查语义冲突、人格分裂、逻辑冗余和系统破坏风险四类问题。
2. **Integration Review**：当 action 为 `integration_review` 时，把目标文件当作组合指导，而不是最终可执行 prompt，检查组合边界是否清楚。
3. **Translation**：当 action 为 `translate` 时，将 `target` 文件翻译到 `targets` 指定的其他语种，**严格保留** Markdown AST 结构。
4. **Refresh Translation**：当 action 为 `refresh_translation` 时，检查 informational 输出中被保留的旧目标语种段是否仍匹配新 source，只更新过期译文。
5. **Semantic Diff**：当 action 为 `diff` 时，读取 `history` 中的历史备份文件，向用户说明本次编译在底层结构上影响了什么。
6. **Policy Review**：当 action 为 `policy_review` 时，检查 manifest、lockfile、format 边界 diagnostics，以及 `policy.contentSignals` 中需要语义判断的词面线索。
7. **Policy Gate**：当 action 为 `policy_gate` 时，说明确定性 policy 已发现阻断风险；在 `security.mode: enforce` 下，VASMC 不会更新 blocked 的 `executable` 或 `integrative` 输出。
8. **Project Review**：当顶层 action 为 `project_review` 时，读取 `.vasmc/project-review-context.yaml` 和 `.vasmc/build-report.yaml`，结合项目文件给出源文件级建议或 patch 建议，不能直接编辑生成物。
9. **Tree-Shake**：当 action 为 `tree_shake` 且用户明确表达了优化 Prompt 的意图时，才执行裁剪分析。

VASMC 负责确定性组装、路由和报告；当前 AI 负责语义判断、翻译和冲突处理。

### Policy 状态

`.vasmc/build-report.yaml` 中每个 entry 都包含 `policy.status`：

* `pass`：无确定性风险信号。
* `review`：允许输出，但 AI 必须审查 report 中的 diagnostics。
* `blocked`：存在可确定的阻断风险，例如 manifest 结构错误、format 边界错误或 lockfile hash 失配。默认 `review` 模式只报告；`enforce` 模式会阻止 blocked 的 `executable` 和 `integrative` 输出被更新。

`policy.contentSignals` 不改变 `policy.status`，也不会触发 enforce 阻断。AI 应判断 signal evidence 是 active instruction、prohibition、example 还是 documentation。

### Project Review

项目可以在 `vasmc-build.yaml` 中开启项目感知审查：

```yaml
ai:
  projectReview:
    mode: suggest
    include:
      - "README.md"
      - "docs/**/*.md"
      - "package.json"
```

这是 AI pass，不是编译器自动重写。VASMC 只生成上下文索引和 report action；当前 AI 根据索引读取项目文件，检查 prompt/skill 是否缺少项目实际命令、目录、术语、约束，`intent` 或 `compile.format` 是否准确，以及是否存在重复 fragment。
