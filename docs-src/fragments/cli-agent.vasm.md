<a name="cli-agent"></a>
## 🤖 LLM 驱动自治模式 (Agent 命令)

大模型辅助编程时代，为了避免 VASMC 内部调取 LLM API 造成的 Token 浪费以及上下文断裂，作为统管全局的 AI 助手，你应该使用 Agent 模式驱动编译：

```bash
vasmc agent [file]
```

> ⚠️ **AI 编辑器始终使用 `vasmc agent`，禁止使用 `vasmc build`。**  
> `vasmc build` 内部会调用 LLM API（用于翻译），是为人类保留的命令。

在该模式下，VASMC 阻断所有内部 LLM 请求，仅执行光速 AST 静态组装。编译完成后，**必然**在项目隐藏目录输出指令清单：

**`.vasmc/agent-instructions.md`**

### AI 助手操作规程

每当你执行了 `vasmc agent` 命令后，**立即读取 `.vasmc/agent-instructions.md`**，并按其中列出的 Action Items 顺序执行以下任务（具体步骤由编译器按需生成）：

1. **Semantic Verify**：读取 Minimal-Token Variant，检查语义冲突、人格分裂、逻辑冗余和系统破坏风险四类问题。
2. **Translation**（按需）：若 instructions 中包含此步骤，将已校验的核心文件翻译到指定的其他语种，**严格保留** Markdown AST 结构。
3. **Semantic Diff**（按需）：若 instructions 中包含此步骤，读取指定的历史备份文件，向用户说明本次编译在底层结构上影响了什么。
4. **Tree-Shake（条件性）**：**仅在**用户明确表达了优化 Prompt 的意图时，才执行裁剪分析。

你是统筹全局的智能主体，而 VASMC 是你最可靠的确权肌肉。
