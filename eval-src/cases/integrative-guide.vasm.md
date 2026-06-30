---
vasm:
  alias: self-eval-integrative-guide
  intent: "Verify integrative format stays composition guidance and does not become a final executable prompt."
  compile:
    format: integrative
    targetLangs: ["zh-CN"]
---

# Skill Bundle Integration Guide

这个文件只描述如何组合多个 VASMC skill source。

整合时：

1. 先读取每个 skill 的 `intent`。
2. 只合并共同的术语、边界和安全约束。
3. 不要把示例 case 的待审内容直接写入最终执行 prompt。
4. 如果两个 skill 的 activation 条件重叠，给出源文件级拆分建议。
