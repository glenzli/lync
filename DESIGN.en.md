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

Once a package is declared and installed via `lync.yaml`, it can be imported into your `.src.md` files using a custom URI scheme: `lync:{alias}`. 

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
    *   **Behavior**: Predicts an alias or respects `--alias <name>`, registers the URL into `lync.yaml`, and executes a sync to download the file and update the lockfile. Path can be overridden via `--dest <path>`.
*   `lync sync`: 
    (Default command, alias: `lync install`) Converges local state with declarations.
    *   **Behavior**: Reads `lync.yaml` and `lync-lock.yaml`. Downloads missing files. If a URL is already in the lockfile, it honors the locked hash state to ensure deterministic builds.
*   `lync update [alias]`: 
    Forces a cache bust to retrieve the latest upstream version.
    *   **Behavior**: Ignores lockfile constraints for a specific alias (or globally). Fetches the latest content from the remote URL, recalculates the hash, and rewrites the lockfile.
*   `lync build [entry]`: 
    The core markdown compiler. Supports single files or entire workspaces.
    *   `lync build main.src.md`
    *   `lync build ./src/**/*.src.md --out-dir ./dist`
    *   **Behavior**: Parses the entry AST tree for `lync:alias` custom links. Replaces `@import:inline` links seamlessly with the raw imported text. Rewrites `@import:link` directives into valid relative physical paths. For massive projects, it is recommended to run without arguments and rely on the build configuration defined in `lync-build.yaml`.

### 3. Workspace Build Configuration

For projects with multiple files or specific output directory requirements (such as outputting to Cursor, Windsurf, or Cline specific directories), Lync relies on a workspace build configuration file to manage bulk compilation and path routing.

Because `lync.yaml` is often automatically modified by the `lync add` command, build configurations are isolated into a dedicated file managed by the developer: **`lync-build.yaml`**.

```yaml
# lync-build.yaml

# Glob patterns to determine entry files
includes:
  - "src/**/*.src.md"

# Default output directory
outDir: "./dist"

# Output routing rules
routing:
  # Route compiled skills into a specific directory
  - match: "*.skill.md"
    dest: "./.agents/skills/"
  # Output the main instruction file into a root rules file
  - match: "main.src.md"
    dest: "./.cursorrules" 
```

With this configuration in place, the workspace compilation command is simply:
**`lync build`** (No arguments needed)

The compiler will read `lync-build.yaml`, scan for entry files based on the `includes` patterns, resolve and expand all dependencies, and route the compiled Markdown artifacts to their respective `dest` paths based on the `routing` rules.

### 3. Safety Guarantees

*   **Strict DAG Enforcement**: During `lync build`, if an imported file imports another file recursively, the compiler must track the call stack. If a circular path is detected (e.g., `A -> B -> C -> A`), abort immediately.
*   **Destination Collision Prevention**: In `lync.yaml`, before `sync`, Lync performs a dry run. If two different aliases share the same local `dest` path, it throws a Fatal Collision Error.
*   **Missing Alias**: If `lync build` encounters a `lync:unknown-alias`, it aborts, demanding the alias be declared in `lync.yaml` first.
