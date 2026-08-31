# A2UI v1.0 spec — from the official package

The conformance target for `src/lib/a2learn/a2ui.ts` is the A2UI spec as
published by the project itself: the exact-pinned `@a2ui/web_core`
devDependency ships the v1.0 JSON schemas, and the lockfile's integrity
hash pins their bytes. Nothing of the upstream spec is committed in this
repo, and `pnpm conformance` reads the schemas from `node_modules`.

Our surfaces deliberately target the *released* schema revision — interop
is with shipped renderers (`@a2ui/react`, `@a2ui/lit`, and friends), not
with the spec repo's HEAD. Updating the spec version is a normal
dependency bump: raise the pin, run `pnpm conformance`, and let the gate
say what the new revision thinks of our surfaces.

The fixtures and golden surfaces under `spec/a2learn/` are ours and stay
committed.
