---
vasm:
  alias: self-eval-link-rewrite
  intent: "Verify @import:link keeps a link boundary while rewriting VASM source references to generated Markdown references."
  compile:
    format: informational
    targetLangs: ["en"]
---

# Link Rewrite Case

Read the shared definition without inlining it:

[Shared Definition](./fragments/shared-definition.vasm.md "@import:link")
