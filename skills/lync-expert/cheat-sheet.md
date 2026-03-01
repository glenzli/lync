# Lync Expert Cheat Sheet

Lync is an AI Prompt Compiler that treats Markdown files as modular programming components. It introduces an AST-level syntax to nest, merge, and localize AI prompts (System Prompts).

## Core Syntax: The Lync Import
Instead of copying and pasting text, Lync resolves dependencies dynamically using Markdown links.
**Syntax:** `[Alias](url "@import:inline")` or `[Alias](url "@import:link")`

- **Inline (`@import:inline`)**: The referenced markdown's exact content replaces this link block during compilation.
- **Link (`@import:link`)**: The referenced file is compiled into a standalone `.md` nearby, and the link resolving to that compiled file is retained.

**Usage:**
```markdown
# My Main Prompt
Please act as an assistant. Here are your strict rules:
[CompanyRules](./rules/base.md "@import:inline")
```

## Internationalization (i18n)
Lync can parse custom HTML comments to isolate language-specific content, preventing the LLM from forcefully translating structural logic.
```markdown
<!-- lang:zh-CN -->
这个块只会在目标为 zh-CN 时出现。
<!-- /lang -->

<!-- lang:en -->
This block only appears when targeting English.
<!-- /lang -->
```

## Command Line Interface (CLI)

Use `lync build` to compile`.lync.md` files into finalized `.md` prompts.

- `lync build <file>`: Compile a specific file.
- `lync build <file> --target-langs zh-CN,ja`: Compile the file specifically into multiple target languages.
- `lync build <file> --verify`: Locally run LLM semantic linting on the final unified prompt logic.
- `lync build <file> --verify-continue-on-error`: Continue compiling even if the LLM verify API call fails.
- `lync build <file> --diff`: Compile the file and use the LLM to semantically compare the new output against the previously compiled version (if it existed), outputting a summary of the semantic structural changes.
- `lync graph <file>`: Statically analyze the AST and print a visual ASCII tree of all nested `@import` dependencies.
- `lync seal <patterns...>`: Inject `lync` metadata (Version, Alias) and generic `<!-- lang -->` tags into standard markdown files, upgrading them to Lync modules. (e.g., `lync seal src/*.md`)
- `lync add <url> --alias <name>`: Download a remote `.lync.md` file securely, saving its exact reference into local `lync.yaml`.
- `lync sync`: Recursively analyze `lync.yaml` and download all remote dependencies into `.lync/`.

## Lync Philosophy
- Treat System Prompts as modular, logical software components.
- Do not make your dependency trees too deep (`> 3` levels), or LLM Attention mechanisms will degrade.
- Do not define variables using traditional mustache templates (`{{user}}`). Rely on semantic natural language for context injection.
