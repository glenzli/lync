# Lync Examples

This directory contains a minimal example workspace demonstrating how Lync works.

## Files

| File | Purpose |
|---|---|
| `lync.yaml` | Declares a remote dependency with alias `greeting` |
| `deps/hello.md` | The cached dependency file (would be fetched by `lync sync`) |
| `main.src.md` | A source file using both `@import:inline` and `@import:link` |

## How to Try

```bash
# 1. Navigate into the example workspace
cd examples/

# 2. Sync the declared dependencies
lync sync

# 3. Compile the source file
lync build main.src.md -o main.md

# 4. Inspect the output!
cat main.md
```

In the output `main.md`:
- The `@import:inline` link will be replaced with the full contents of `deps/hello.md`.
- The `@import:link` link's URL will be rewritten to the relative path `./deps/hello.md`.
