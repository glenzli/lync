# Lync Protocol & Compiler Specification (Draft)

Lync is a lightweight, decentralized package manager and compiler designed specifically for Markdown files in the era of LLMs. It treats Markdown as source code, providing robust mechanisms for dependency management, inline composition, and deterministic builds without relying on centralized registries.

## Part 1: Package Management (Install)

Lync uses a centralized manifest file to declare remote dependencies before they can be used in your Markdown source files. This prevents URL scattering, allows for clean version control, and establishes local aliases.

### 1. The Manifest (`lync.yaml`)

The `lync.yaml` file sits at the root of your workspace. It binds a remote URL to a short, local **Alias**.

```yaml
dependencies:
  # Scenario A: Cache-only dependency. Downloaded internally, not visible in your workspace.
  # Perfect for context injection or inline expansion.
  company-rules: "https://example.com/guidelines.md"
  
  # Scenario B: Explicit local destination. Downloaded to a specific physical path.
  # Perfect for building a local knowledge base or skill folder.
  coder-skill:
    url: "https://example.com/coder-skill.md"
    dest: "./skills/coder.md"
```

### 2. Alias Generation & Collision Handling

Aliasing in Lync requires the developer to ensure uniqueness within their own `lync.yaml`.
*   **The Alias acts as the Primary Key** in your local scope (e.g., `company-rules`). If you declare the same alias twice, the YAML parser will simply overwrite it or throw a syntax error.
*   By decoupling the global, decentralized URL from your local Alias, Lync gracefully solves the naming collision problem: If ZhangSan and LiSi both publish a file named `coder.md`, you can simply alias them locally as `coder-zs` and `coder-ls` in your manifest.

When a developer **manually edits `lync.yaml`**, the **key (e.g., `coder-skill`) is the explicit alias.**
When installing via the CLI `lync add <url>`, the CLI automatically deduces and writes the alias to `lync.yaml` following this priority:
1. **Explicit Flag**: `lync add https://.../foo.md --alias bar` resolves to `bar`.
2. **Filename Inference**: Extracts the last segment of the URL minus extension. E.g., `.../my-skill.md` becomes `my-skill`.
3. **Numeric Suffix Fallback**: If `my-skill` is already registered to another URL in the local yaml, a numeric suffix is appended (e.g., `my-skill-1`) to avoid overriding existing setups. The user can always rename it later in `lync.yaml`.

### 3. Local Cache Directory & Version Control

When a dependency is declared **without a `dest`** field, `lync sync` downloads it into the hidden **`.lync/`** directory under the project root (e.g., `.lync/company-rules.md`). This directory is an internal cache and should be excluded via `.gitignore`:

```gitignore
# Lync internal cache (managed automatically by lync sync)
.lync/
```

> **Note**: `lync-lock.yaml` **should be committed** to version control. Similar to `package-lock.json`, it guarantees deterministic builds—team members running `lync sync` will restore the exact same dependency state based on this file.

---

## Part 2: Code Importation (Import)

Once a package is declared and installed via `lync.yaml`, it can be imported into your `.lync.md` files using a custom URI scheme: `lync:{alias}`. 

The core design principle is **graceful degradation**: Compilation directives are encoded within standard Markdown link titles to ensure uncompiled source files remain readable in generic viewers.

### The Import Syntax

`[Link Text](lync:alias "@lync-directive")`

*   **Link Mode (`@import:link`)**: 
    The compiler replaces the `lync:alias` URI with the local relative physical path of the target file, preserving the hyperlink structure.
    ```markdown
    Please refer to the [Coding Assistant Skill](lync:coder-skill "@import:link").
    ```
    *Compiled Output*: `Please refer to the [Coding Assistant Skill](./skills/coder.md).`

*   **Inline Mode (`@import:inline`)**:
    The compiler reads the raw text content of the target file and replaces the entire hyperlink with this content. This is primarily used for assembling large prompt contexts.
    ```markdown
    According to the [Company Development Guidelines](lync:company-rules "@import:inline"):
    ```
    *Compiled Output*: The original link is removed and the complete text content of `guidelines.md` is inserted at its position.

---

## Part 3: The Lync Compiler

The Lync CLI is the execution engine for the protocol.

### 1. The Lockfile (`lync-lock.yaml`)

While `lync.yaml` is for humans, `lync-lock.yaml` is strictly machine-generated. It maps the local Alias to the exact URL, destination, and the resolved SHA-256 hash (or frontmatter version). This guarantees deterministic synchronization across machines.

**Example Format:**
```yaml
version: 1
dependencies:
  coder-skill:
    url: "https://example.com/coder-skill.md"
    dest: "./skills/coder.md"
    version: "1.2.0"
    hash: "e3b0c442..."
    fetchedAt: "2026-02-26T20:50:36Z"
```

### 2. Detailed CLI Commands

*   `lync add <url> [options]`: 
    One-click dependency fetching and registration.
    *   **Behavior**: Registers the URL into `lync.yaml`, and executes a sync to download the file and update the lockfile. Path can be overridden via `--dest <path>`.
    *   **Smart Alias Inference**: To prevent generic names like `prompt.md` from constantly polluting the namespace, Lync infers the alias using the following priority:
        1. **Declarative Frontmatter**: Lync inspects the remote file's YAML frontmatter for an official `lync.alias` field.
        2. **Heuristic URL Traversal**: If un-declared and the URL ends with meaningless generic words (e.g., `main`, `index`, `prompt`, `src`, `master`), Lync automatically steps backward up the directory tree until it finds a recognizable, meaningful directory name.
        3. On naming collisions, it appends an incrementing counter. Authors can always manually override it via `--alias <name>`.
*   `lync sync`: 
    (Default command, alias: `lync install`) Converges local state with declarations.
    *   **Behavior**: Reads `lync.yaml` and `lync-lock.yaml`. Downloads missing files. If a URL is already in the lockfile, it honors the locked hash state to ensure deterministic builds.
*   `lync update [alias]`: 
    Forces a cache bust to retrieve the latest upstream version.
    *   **Behavior**: Ignores lockfile constraints for a specific alias (or globally). Fetches the latest content from the remote URL, recalculates the hash, and rewrites the lockfile.
*   `lync seal <file>`: 
    (Module Initialization) "Seals" a standard Markdown file into a formalized Lync Module.
    *   **Behavior**: Injects standard YAML Frontmatter declaring the `alias` and `version` into the file. It intelligently infers the alias from the file path leveraging `lync add`'s heuristic logic (ignoring generics like `index`), or accepts a forced name via `--alias <name>`. It then automatically renames the file to a `.lync.md` extension.
*   `lync build [entry]`: 
    The core markdown compiler. Supports single files or entire workspaces.
    *   `lync build main.lync.md -o main.md`
    *   `lync build --out-dir ./dist --base-dir ./src`
    *   **Behavior**: Parses the entry AST tree for `lync:alias` custom links. Replaces `@import:inline` links seamlessly with the raw imported text. Rewrites `@import:link` directives into valid relative physical paths. Supports `--out-dir` and `--base-dir` for ad-hoc bulk mapping, but it is recommended to run without arguments and rely on the build configuration defined in `lync-build.yaml`.

### 3. Workspace Build Configuration

For projects with multiple files or specific output directory requirements (such as outputting to Cursor, Windsurf, or Cline specific directories), Lync relies on a workspace build configuration file to manage bulk compilation and path routing.

Because `lync.yaml` is often automatically modified by the `lync add` command, build configurations are isolated into a dedicated file managed by the developer: **`lync-build.yaml`**.

```yaml
# lync-build.yaml

# Glob patterns to determine entry files
includes:
  - "src/**/*.lync.md"

# Default output directory
outDir: "./dist"

# Strip this prefix directory from original paths when mapping to output
baseDir: "./src"

# Output routing rules
routing:
  # Route compiled skills into a specific directory
  - match: "*.skill.md"
    dest: "./.agents/skills/"
  # Output the main instruction file into a root rules file
  - match: "main.lync.md"
    dest: "./.cursorrules" 
```

With this configuration in place, the workspace compilation command is simply:
**`lync build`** (No arguments needed)

The compiler will read `lync-build.yaml`, scan for entry files based on the `includes` patterns, resolve and expand all dependencies, and route the compiled Markdown artifacts to their respective `dest` paths based on the `routing` rules.

### 4. LLM-Powered Semantic Linting

Since Lync assembles prompts for Large Language Models, traditional module resolution cannot detect contradictions in plain text.

When running `lync build --verify`, Lync calls an LLM (requires `OPENAI_API_KEY` in environment, customizable via `--model`) to perform static analysis on the assembled text. It checks for:
*   **Instruction Conflicts**: Contradictory rules from different nested dependencies.
*   **Persona Consistency**: Inconsistent role definitions or tones.
*   **Security Risks**: Malicious instructions or prompt injection attempts in remote modules.
*   **Logic Redundancy**: Unnecessary repetitions wasting token space.

### 5. Multilingual Native i18n & LLM Fallback Translation

Prompt engineering inevitably encounters language barriers. A high-quality instructional prompt written in English might lose its nuance if merely translated by a generic pipeline after assembly. 
To solve this, Lync introduces **AST-level i18n support combined with dynamic LLM Fallback Translation.**

Authors can use standard Markdown block directives (`:::`) to wrap language-specific prose, while keeping structural codes, examples, and rules language-agnostic.

```markdown
# Universal Rules
You are an expert coder.

:::lang{lang="en"}
Explain this code clearly.
:::

:::lang{lang="zh-CN"}
请清楚地解释这段代码。
:::
```

When building, the consumer specifies the required target language(s), either via `lync-build.yaml` (`targetLangs: ["en", "ja"]`) or the CLI (`--target-langs ja`):
- Lync traverses the AST and intelligently filters out all `:::lang{}` blocks that do NOT match the target language.
- **LLM Fallback Translation**: If the requested target language (e.g., `ja`) does not exist natively in the file, Lync isolates the best available language block, uses an internal localization System Prompt via the OpenAI API, translates *only the prose* into Japanese (preserving code blocks and Lync specific directives), and hot-swaps the translated AST directly into the final artifact!
- **Legacy Compatibility**: If a file possesses no `:::lang{}` blocks at all, Lync will translate the entire document upon request.

This ensures prompt engineers can maintain all languages natively within a single `.lync.md` file, drastically simplifying global distribution.

### 5. Multilingual Native i18n & LLM Fallback Translation

Prompt engineering inevitably encounters language barriers. A high-quality instructional prompt written in English might lose its nuance if merely translated by a generic pipeline after assembly. 
To solve this, Lync introduces **AST-level i18n support combined with dynamic LLM Fallback Translation.**

Authors can use standard Markdown block directives (`:::`) to wrap language-specific prose, while keeping structural codes, examples, and rules language-agnostic:

```markdown
# Universal Rules
You are an expert coder.

:::lang{lang="en"}
Explain this code clearly.
:::

:::lang{lang="zh-CN"}
请清楚地解释这段代码。
:::
```

When building, the consumer specifies the required target language(s), either via `lync-build.yaml` (`targetLangs: ["en", "ja"]`) or the CLI (`--target-langs ja`):
- Lync traverses the AST and intelligently filters out all `:::lang{}` blocks that do NOT match the target language.
- **LLM Fallback Translation**: If the requested target language (e.g., `ja`) does not exist natively in the file, Lync isolates the best available language block, uses an internal localization System Prompt via the OpenAI API, translates *only the prose* into Japanese (preserving code blocks and Lync specific directives), and hot-swaps the translated AST directly into the final artifact!
- **Legacy Compatibility**: If a file possesses no `:::lang{}` blocks at all, Lync will translate the entire document upon request.

This ensures prompt engineers can maintain all languages natively within a single `.lync.md` file, drastically simplifying global distribution.

---

## Part 4: Version Management & Dependency Mechanisms

Markdown files are often published via URLs without strict version histories. The content of a URL can change at any time. Lync handles this with the following mechanisms:

### 1. Distributing Compiled Artifacts (Compiled Release)

To prevent LLM "hallucinations" caused by conflicting logic, Lync **discourages deep, dynamic dependency trees** for public distribution.
If Module B relies on Module C, the author of B is recommended to use `lync build` to publish a fully inlined, static Markdown file (`*.md`).
Source forms (`*.lync.md` containing `lync:xxx` directives) are better suited for internal project workflows, where `lync.yaml` can explicitly manage versions.

### 2. Module Metadata (Lync Frontmatter Protocol)

Lync encourages module authors to declare their official alias, version, and external dependencies using YAML Frontmatter at the top of their source files. This not only aids human comprehension but also serves as the highest priority data source for `lync add`'s smart parser.

> **Best Practice (Extension & Auto-Stripping)**:
> It is highly recommended to use the **`.lync.md`** extension for source files distributed as Lync modules. 
> This emphasizes a crucial boundary: files with YAML Frontmatter and `@import` tags are engineering sources meant for "Humans and the Lync Compiler". When a user runs `lync build`, the compiler automatically **strips all YAML meta-data**. The resulting assembled `.md` file is pure natural language, ensuring absolutely no noise or distraction is fed into the LLM's context window.

```yaml
---
lync:
  alias: "my-coder-prompt"
  version: "1.0.0"
  dependencies:
    anti-delusion: "https://example.com/system.md"
---

# Your Prompt Content here...
```

*   **alias**: Highly recommended. When other users execute `lync add <your-url>`, Lync will prioritize this field as the default mapped alias in their local namespace.
*   **version**: Metadata meant for humans to evaluate compatibility (the Lync engine relies solely on content Hashes for strict locking).
*   **dependencies**: Declares the **indispensable remote dependencies** required for this module to function. When users fetch your module, Lync's `sync` engine automatically parses these nested dependencies and installs them flatly into the user's workspace (strictly adhering to the "root-overrides" rule to prevent conflicts).

### 3. Flat Resolution & Semantic Conflict Management 

When nested dependencies are necessary, Lync enforces a flat namespace without multiple nested versions.
However, if a dependency conflict arises, Lync does not blindly force a hard override like traditional code package managers. Replacing a natural language module arbitrarily can severely break the prompt's context continuity.
Instead, Lync relies on the **LLM Linter** (`--verify`) to detect irreconcilable semantic conflicts after assembly, leaving the structural and logical fixes to the developer.

### 4. Hash-Based Locking

When `lync sync` fetches a file, it records its SHA-256 hash in `lync-lock.yaml`. 
Future builds will use this local snapshot. Even if the upstream URL is altered, Lync will use the local cache that matches the hash.
Developers must explicitly run `lync update <alias>` to fetch new content, preventing upstream changes from silently breaking the local build.

> **The Role of Versions**: In traditional package managers, explicit versions dictate resolution. In Lync's core execution architecture, **Hash is the sole source of truth**. While authors are still encouraged to include a `version` field in their Markdown Frontmatter to help developers understand semantics and manually track compatibility, the Lync execution engine relies entirely on raw content hashing to detect and lock dependencies.

### 5. Local Relative Imports

When your Prompt modules are split within the same local directory, forcing dependencies through `lync.yaml` is unnecessary.
Within the same project, you can directly utilize native Markdown relative paths for imports:

```markdown
# My System Prompt
[Import Local Persona](./prompts/persona.lync.md "@import:inline")
[Import Remote Anti-Delusion](lync:anti-delusion "@import:inline")
```

The compiler automatically recognizes links starting with `./` or `../`. This not only allows you to click and jump to the source file in mainstream editors but also **exempts locally referenced files from forced Hash Lock calculations**, inherently supporting real-time local debugging and hot-reloading.

---

## Part 5: Safety Guarantees

*   **Strict DAG Enforcement**: During `lync build`, if an imported file imports another file recursively, the compiler must track the call stack. If a circular path is detected (e.g., `A -> B -> C -> A`), abort immediately.
*   **Destination Collision Prevention**: In `lync.yaml`, before `sync`, Lync performs a dry run. If two different aliases share the same local `dest` path, it throws a Fatal Collision Error.
*   **Missing Alias**: If `lync build` encounters a `lync:unknown-alias`, it aborts, demanding the alias be declared in `lync.yaml` first.
