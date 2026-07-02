---
vasm:
  alias: self-eval-circular-a
  intent: "Verify circular inline imports fail the compile step."
  compile:
    format: executable
    targetLangs: ["en"]
---

# Circular A

[Circular B](./circular-b.vasm.md "@import:inline")
