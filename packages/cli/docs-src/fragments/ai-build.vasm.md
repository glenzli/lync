<a name="cli-ai-build"></a>
## 🤖 AI Build 工作流

大模型辅助编程时代，VASMC 只负责确定性组装；语义校验、翻译、Diff 和裁剪应由当前 AI 接管。作为统管全局的 AI 助手，你应该使用 AI 侧 build 驱动编译：

```bash
vasmc build [file]
```

> **AI 编辑器始终使用 `vasmc build`。**  
> 在 `@vasm/cli` 中，`build` 会同时产出确定性 Markdown 和 `.vasmc/build-instructions.md` 后续工作单。

在该模式下，VASMC 执行 AST 静态组装，并在项目隐藏目录输出指令清单和结构化报告：

**`.vasmc/build-instructions.md`**

**`.vasmc/build-report.yaml`**

### AI 助手操作规程

每当你执行了 `vasmc build` 命令后，**立即读取 `.vasmc/build-instructions.md`**，并按其中列出的 Action Items 顺序执行以下任务（具体步骤由编译器按需生成）：

1. **Semantic Verify**：读取 Minimal-Token Variant，检查语义冲突、人格分裂、逻辑冗余和系统破坏风险四类问题。
2. **Translation**（按需）：若 instructions 中包含此步骤，将已校验的核心文件翻译到指定的其他语种，**严格保留** Markdown AST 结构。
3. **Semantic Diff**（按需）：若 instructions 中包含此步骤，读取指定的历史备份文件，向用户说明本次编译在底层结构上影响了什么。
4. **Policy Review**（按需）：若 instructions 中包含此步骤，读取 `.vasmc/build-report.yaml`，检查 skill manifest 的 scope、capabilities、activation 和 trust 声明是否足够明确。
5. **Policy Gate**（按需）：若 instructions 中包含此步骤，说明确定性 policy 已发现阻断风险；在 `security.mode: enforce` 下，VASMC 不会更新该 skill 的正式输出。
6. **Tree-Shake（条件性）**：**仅在**用户明确表达了优化 Prompt 的意图时，才执行裁剪分析。

你是统筹全局的智能主体，而 VASMC 是你最可靠的确权肌肉。

### Policy 状态

`.vasmc/build-report.yaml` 中每个 entry 都包含 `policy.status`：

* `pass`：无确定性风险信号。
* `review`：允许输出，但 AI 必须审查 report 中的 diagnostics。
* `blocked`：存在可确定的阻断风险，例如依赖 capability 越权或 lockfile hash 失配。默认 `review` 模式只报告；`enforce` 模式会阻止 unsafe skill 输出被更新。
