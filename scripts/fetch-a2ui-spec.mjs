/**
 * Fetch the pinned A2UI spec files instead of committing copies of them.
 *
 * `spec/a2ui/manifest.json` is what the repo owns: the upstream repo, a
 * commit, and a SHA-256 per file. This script materializes the files into
 * the gitignored `spec/a2ui/v1_0/` and refuses anything whose bytes don't
 * match the pin — same determinism as vendoring, none of the copied bulk.
 * Bumping the spec version is editing the manifest, which is a reviewable
 * contract change, exactly as re-vendoring was.
 *
 *   node scripts/fetch-a2ui-spec.mjs        fetch whatever is missing/stale
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const specDir = join(root, 'spec', 'a2ui', 'v1_0');
const manifest = JSON.parse(readFileSync(join(root, 'spec', 'a2ui', 'manifest.json'), 'utf8'));

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

export async function ensureA2UISpec() {
  const repoPath = new URL(manifest.source).pathname.replace(/^\//, '');
  for (const [local, entry] of Object.entries(manifest.files)) {
    const target = join(specDir, local);
    if (existsSync(target) && sha256(readFileSync(target)) === entry.sha256) continue;

    const url = `https://raw.githubusercontent.com/${repoPath}/${manifest.commit}/${entry.upstream}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`fetching ${url} failed: ${res.status} ${res.statusText}`);
    }
    const body = Buffer.from(await res.arrayBuffer());
    const actual = sha256(body);
    if (actual !== entry.sha256) {
      throw new Error(
        `${local}: upstream bytes do not match the pinned checksum\n  expected ${entry.sha256}\n  received ${actual}\nRefusing to write — the manifest pin is the contract.`,
      );
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body);
    console.log(`✓ ${local} (${body.length} bytes, checksum verified)`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await ensureA2UISpec();
  console.log('A2UI spec present and pinned.');
}
