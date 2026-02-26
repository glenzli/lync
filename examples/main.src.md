# My Awesome Prompt

This prompt demonstrates both Lync import modes.

## Inline Import

The following content will be **replaced** with the full text of the dependency at compile time:

[Greeting Content](lync:greeting "@import:inline")

## Link Import

The following link will be **rewritten** to a local relative path at compile time:

[See the Greeting File](lync:greeting "@import:link")
