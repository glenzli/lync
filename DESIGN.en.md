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

---

## Part 2: Code Importation (Import)

Once a package is declared and installed via `lync.yaml`, it can be imported into your `.src.md` files using a custom URI scheme: `lync:{alias}`. 

The core philosophy remains **graceful degradation**: Compilation directives are hidden within standard Markdown link titles.

### The Import Syntax

`[Human Readable Name](lync:alias "@lync-directive")`

*   **Link Mode (`@import:link`)**: 
    Simply rewrites the `lync:alias` to the physical relative path of the downloaded file. This maintains a clickable structure in the final compiled Markdown.
    ```markdown
    Please refer to the [Coding Assistant Skill](lync:coder-skill "@import:link").
    ```
    *Compiled Output*: `Please refer to the [Coding Assistant Skill](./skills/coder.md).`

*   **Inline Mode (`@import:inline`)**:
    Used to literally expand/paste the contents of the aliased module at the current position. Perfect for flatting prompts.
    ```markdown
    According to the [Company Development Guidelines](lync:company-rules "@import:inline"):
    ```
    *Compiled Output*: The link is entirely replaced by the raw text of `guidelines.md`.

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
    *   **Behavior**: Predicts an alias or respects `--alias <name>`, registers the URL into `lync.yaml`, and executes a sync to download the file and update the lockfile. Path can be overridden via `--dest <path>`.
*   `lync sync`: 
    (Default command, alias: `lync install`) Converges local state with declarations.
    *   **Behavior**: Reads `lync.yaml` and `lync-lock.yaml`. Downloads missing files. If a URL is already in the lockfile, it honors the locked hash state to ensure deterministic builds.
*   `lync update [alias]`: 
    Forces a cache bust to retrieve the latest upstream version.
    *   **Behavior**: Ignores lockfile constraints for a specific alias (or globally). Fetches the latest content from the remote URL, recalculates the hash, and rewrites the lockfile.
*   `lync build <entry.src.md>`: 
    The core markdown compiler.
    *   **Behavior**: Parses the `entry.src.md` AST tree for `lync:alias` custom links. Replaces `@import:inline` links seamlessly with the raw imported string text from cache/dest. Rewrites `@import:link` directives into valid relative physical paths (e.g. `./skills/foo.md`). Outputs the finalized, self-contained Markdown string.

### 3. Safety Guarantees

*   **Strict DAG Enforcement**: During `lync build`, if an imported file imports another file recursively, the compiler must track the call stack. If a circular path is detected (e.g., `A -> B -> C -> A`), abort immediately.
*   **Destination Collision Prevention**: In `lync.yaml`, before `sync`, Lync performs a dry run. If two different aliases share the same local `dest` path, it throws a Fatal Collision Error.
*   **Missing Alias**: If `lync build` encounters a `lync:unknown-alias`, it aborts, demanding the alias be declared in `lync.yaml` first.
