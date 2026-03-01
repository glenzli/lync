# Lync Expert Skill Pipeline

This directory contains the necessary components and pipeline to generate `lync-expert.md`, a highly-condensed **standalone System Prompt** designed for AI code editors (like Cursor, Windsurf, or Copilot).

When you feed `lync-expert.md` to your editor (e.g., placing it in `.cursorrules`), the AI instantly becomes a master at comprehending, writing, and debugging Lync's AST-based markdown prompts.

## How it works (The Dogfooding Pipeline)

Instead of manually maintaining a cheat sheet when Lync's overarching syntax changes, this repository uses Lync to document Lync.

### 1. The Extraction Prompt (`extract-cheat-sheet.lync.md`)
This file is an extraction prompt. It utilizes Lync's `@import:inline` to dynamically suck in the entirety of the project's root `HELP.md` and `DESIGN.en.md`.
It instructs an LLM to read these massive documents and distill them into an ultra-concise `cheat-sheet.md`.

**To update the Cheat Sheet:**
\`\`\`bash
# 1. Compile the extraction prompt
lync build extract-cheat-sheet.lync.md -o .

# 2. Feed 'extract-cheat-sheet.md' to your favorite LLM (e.g., ChatGPT, Claude)
# 3. Save the LLM's raw markdown output as 'cheat-sheet.md' in this directory.
\`\`\`

### 2. The Main Skill (`main.lync.md`)
This file defines the strict Persona and ruleset for the AI Editor. It uses `@import:inline` to pull in the `cheat-sheet.md` you generated in the previous step.

### 3. Final Build (`lync build`)
To package everything into the final, redistributable `lync-expert.md`:

\`\`\`bash
lync build
\`\`\`
*(This directory contains a `lync-build.yaml` configured to compile `main.lync.md` directly into `lync-expert.md` in this folder).*

---

> **Note:** The pre-compiled `lync-expert.md` is already committed to this repository. You only need to run this pipeline if the core Lync `HELP.md` or `DESIGN.md` documentation has significantly changed.
