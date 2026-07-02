---
vasm:
  alias: self-eval-informational-merge
  intent: "Verify informational format merges multiple languages and inline fragments without leaking VASM metadata."
  compile:
    format: informational
    targetLangs: ["en", "zh-CN"]
---

# Informational Merge Case

<!-- lang:en -->
English evaluation documentation.

[Shared](./fragments/shared-definition.vasm.md "@import:inline")
<!-- /lang -->

<!-- lang:zh-CN -->
中文评估文档。

[Shared](./fragments/shared-definition.vasm.md "@import:inline")
<!-- /lang -->
