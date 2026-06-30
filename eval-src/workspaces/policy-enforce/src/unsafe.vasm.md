---
vasm:
  alias: self-eval-policy-enforce-unsafe
  kind: skill
  intent: "Verify security.mode=enforce blocks executable outputs with manifest errors."
  compile:
    format: executable
    targetLangs: ["en"]
---

# Unsafe Enforce Case

This output should not be written because the manifest contains a removed field.
