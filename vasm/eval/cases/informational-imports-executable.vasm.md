---
vasm:
  alias: self-eval-informational-imports-executable
  intent: "Verify informational outputs cannot silently absorb executable prompt content."
  compile:
    format: informational
    targetLangs: ["en"]
---

# Informational Boundary Case

This informational document incorrectly imports executable runtime behavior:

[Runtime Fragment](./fragments/executable-runtime.vasm.md "@import:inline")
