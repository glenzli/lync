---
description: 更新 vasmc-expert 技能（重新提取知识手册并重编译）
---

# 更新 vasmc-expert 技能

当 VASMC 的 DESIGN 或 HELP 文档发生变更后，执行此流水线以保持 `vasmc-expert` 技能与最新文档同步。

## 步骤

1. 先确保文档已编译为最新版本：
// turbo
```bash
npm run build && node dist/index.js build
```

2. 编译 `extract-vasmc-knowledge.vasm.md` 为扁平化 Prompt，输出到临时目录 `.vasmc/`（不进版本控制）：
// turbo
```bash
node dist/index.js build skill-src/vasm-expert/extract-vasmc-knowledge.vasm.md
```

3. 阅读编译后的知识提取 Prompt，按照其中的指令生成新的 `vasmc-knowledge.md`：
   - 读取 `skills/vasm-expert/extract-vasmc-knowledge.md` 文件内容
   - 按照 Prompt 中的角色和操作指南，生成**专供 AI Agent 使用**的四章知识手册：
     1. VASMC 是什么（心智模型）
     2. 项目结构与文件职责
     3. 语法速查（含示例）
     4. AI 专用 CLI 命令（只含零 LLM 调用命令，明确排除 build/lint/diff）
   - 将结果**直接覆写**到 `skill-src/vasm-expert/vasmc-knowledge.md`

4. 重新编译 `vasmc-expert` 技能（将新的知识手册内联进最终可执行文件）：
// turbo
```bash
node dist/index.js build skill-src/vasm-expert/vasmc-expert.vasm.md
```

5. 验证最终产物：
// turbo
```bash
head -5 skills/vasm-expert/SKILL.md
```

完成后，`skills/vasm-expert/SKILL.md` 即为最新的自包含可执行技能文件。

