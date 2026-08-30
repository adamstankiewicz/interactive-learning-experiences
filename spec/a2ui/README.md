# A2UI v1.0 spec — pinned, not vendored

The conformance target for `src/lib/a2learn/a2ui.ts` is Google's A2UI v1.0
spec ([google/A2UI](https://github.com/google/A2UI), Apache-2.0). We do not
commit copies of their files; `manifest.json` pins an upstream commit and a
SHA-256 per file, and `scripts/fetch-a2ui-spec.mjs` materializes them into
the gitignored `v1_0/` — refusing any bytes that don't match the pin.

`pnpm conformance` fetches automatically when files are missing. To update
the spec version: edit `manifest.json` (new commit + new checksums) — a
reviewable contract change, exactly as re-vendoring was — never by editing
fetched files in place.

The fixtures and golden surfaces under `spec/a2learn/` are ours and stay
committed.
