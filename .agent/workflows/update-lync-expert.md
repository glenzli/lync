---
description: 更新 lync-expert 技能（重新提取知识手册并重编译）
---

# 更新 lync-expert 技能

当 Lync 的 DESIGN 或 HELP 文档发生变更后，执行此流水线以保持 `lync-expert` 技能与最新文档同步。

## 步骤

1. 先确保文档已编译为最新版本：
// turbo
```bash
cd /Users/g4i/lab/lync && npm run build && node dist/index.js build
```

2. 编译 `extract-lync-knowledge.lync.md` 为扁平化 Prompt，输出到临时目录 `.lync/`（不进版本控制）：
// turbo
```bash
cd /Users/g4i/lab/lync && node dist/index.js build skill-src/lync-expert/extract-lync-knowledge.lync.md
```

3. 阅读编译后的知识提取 Prompt，按照其中的指令生成新的 `lync-knowledge.md`：
   - 读取 `.lync/extract-lync-knowledge.md` 文件内容
   - 按照 Prompt 中的角色和操作指南，生成**专供 AI Agent 使用**的四章知识手册：
     1. Lync 是什么（心智模型）
     2. 项目结构与文件职责
     3. 语法速查（含示例）
     4. AI 专用 CLI 命令（只含零 LLM 调用命令，明确排除 build/lint/diff）
   - 将结果**直接覆写**到 `skill-src/lync-expert/lync-knowledge.md`

4. 重新编译 `lync-expert` 技能（将新的知识手册内联进最终可执行文件）：
// turbo
```bash
cd /Users/g4i/lab/lync && node dist/index.js build skill-src/lync-expert/lync-expert.lync.md
```

5. 验证最终产物：
// turbo
```bash
cat /Users/g4i/lab/lync/skills/lync-expert/lync-expert.md | head -5
```

完成后，`skills/lync-expert/lync-expert.md` 即为最新的自包含可执行技能文件。
