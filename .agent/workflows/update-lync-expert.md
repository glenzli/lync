---
description: 更新 lync-expert 技能（重新提取速查表并重编译）
---

# 更新 lync-expert 技能

当 Lync 的 DESIGN 或 HELP 文档发生变更后，执行此流水线以保持 `lync-expert` 技能与最新文档同步。

## 步骤

1. 先确保文档已编译为最新版本：
// turbo
```bash
cd /Users/g4i/lab/lync && npm run build && node dist/index.js build
```

2. 编译 `extract-cheat-sheet.lync.md` 为扁平化 Prompt（此步不产出文件，只是展开内联引用供你阅读）：
// turbo
```bash
cd /Users/g4i/lab/lync && node dist/index.js build skill-src/lync-expert/extract-cheat-sheet.lync.md
```

3. 阅读编译后的 `extract-cheat-sheet` Prompt 产物，按照其中的指令生成新的 `cheat-sheet.md`：
   - 读取编译产物文件内容
   - 按照 Prompt 中的角色和操作指南，生成纯中文的极简速查表
   - 将结果**直接覆写**到 `skill-src/lync-expert/cheat-sheet.md`

4. 重新编译 `lync-expert` 技能（将新的 cheat-sheet 内联进最终可执行文件）：
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
