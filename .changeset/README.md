# Changesets

This directory tracks release intent for the VASMC npm workspaces.

Run `npm run changeset` after a user-facing package change, choose the affected package group and SemVer bump, then run `npm run release:version` before publishing.

The VASMC packages are configured as a fixed version group because `@vasm/cli` and `@vasm/console` bundle the shared core into their published binaries.
