---
vasm:
  alias: self-eval-executable-ai-actions
  intent: "Verify AI build emits review and translation actions for executable prompts without pre-generating untranslated target variants."
  compile:
    format: executable
    targetLangs: ["en", "zh-CN"]
---

# Release Note Reviewer

Review a release note draft for clarity, factual consistency, and missing migration notes.

Return:

1. A short verdict.
2. A list of concrete problems.
3. Source-level suggestions for the `.vasm.md` file when the compiled prompt is unclear.
