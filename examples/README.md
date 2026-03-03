# VASMC Examples

This directory demonstrates VASMC's powerful cross-compilation and modular prompt design.

## Key Features

- **Language blocks**: Using `<!-- lang:xx -->` for standard Markdown compatibility.
- **Deep Cascading**: `@import:inline` now propagates target languages recursively.
- **Heuristic Sealing**: `vasmc seal` can automatically wrap prompts in language blocks.

## Example Structure

- `main.vasm.md`: The entry point with language blocks and an inline import.
- `lib/core.vasm.md`: A modular piece of prompt logic, also supporting multiple languages.

## How to Try

### 1. Build for English
```bash
vasmc build main.vasm.md --target-langs en -o out/en.md
# Observe how both main and lib content are filtered to English.
```

### 2. Build for Chinese (with auto-translation)
```bash
vasmc build main.vasm.md --target-langs zh-CN -o out/zh.md
# Observe how matching blocks are used, and missing ones would be LLM-translated.
```

### 3. Try the Seal Command
```bash
echo "Hello World" > new-prompt.md
vasmc seal new-prompt.md --lang en
# See how 'new-prompt.vasm.md' is created with both Frontmatter and language blocks!
```
