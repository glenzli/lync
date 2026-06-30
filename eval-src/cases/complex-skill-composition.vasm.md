---
vasm:
  alias: self-eval-complex-skill-composition
  intent: "Verify a realistic executable prompt assembled from multiple fragments remains coherent, bounded, and actionable."
  compile:
    format: executable
    targetLangs: ["zh-CN"]
---

# Release Note Review Skill

[Role](./fragments/release-review-role.vasm.md "@import:inline")

[Boundaries](./fragments/release-review-boundaries.vasm.md "@import:inline")

[Output](./fragments/release-review-output.vasm.md "@import:inline")

[Noise Budget](./fragments/release-review-noise.vasm.md "@import:inline")

## 审查重点

检查 release note 是否遗漏 breaking change、迁移说明、包名、版本号和安全边界变化。
