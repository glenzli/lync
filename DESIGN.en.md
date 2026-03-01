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

## Part 3: The Lync Compiler & CLI Overview

The Lync CLI is the execution engine for the protocol.

### 1. The Lockfile (`lync-lock.yaml`)

While `lync.yaml` is for humans, `lync-lock.yaml` is strictly machine-generated. It maps the local Alias to the exact URL, destination, and the resolved SHA-256 hash (or frontmatter version). This guarantees deterministic synchronization across machines.

### 2. CLI Commands & Advanced Capabilities

Lync provides a suite of CLI tools to manage the module lifecycle, including:
*   **Dependency Management**: `install`, `add`, `update`
*   **Module Encapsulation**: The `seal` command extracts YAML frontmatter and intelligently renames files.
*   **Compile Routing**: Zero-config batch AST-level compilation via `lync-build.yaml`.
*   **Semantic Linting**: Integrated LLM native Linter to flag conflicts, persona drifts, and security risks.
*   **AST-Level i18n**: Smart compilation of language blocks, falling back to dynamic translation via LLM for missing elements.

> 👉 **Full Guide**: For detailed instructions on using the Lync CLI, global `.lyncrc` configuration, custom LLM integration, and workspace build routing, please refer to the [**Lync Help & Usage Document (HELP.md)**](HELP.md).
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
