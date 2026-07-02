---
vasm:
  alias: self-eval-release-review-output
  compile:
    format: executable
---

## 输出格式

必须返回三个部分：

1. `结论`：pass、review 或 fail。
2. `问题`：按严重程度列出。
3. `源文件建议`：只指向 `.vasm.md` 或 package metadata。
