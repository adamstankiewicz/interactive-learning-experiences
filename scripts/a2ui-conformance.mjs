/**
 * A2UI conformance: prove the boundary mapper's output against Google's own
 * v1.0 schemas, not against our opinion of them.
 *
 *   pnpm conformance           validate fixtures + compare golden surfaces
 *   pnpm conformance:update    regenerate the golden surfaces
 *
 * Three layers of checking, strictest first:
 *  1. Schema: every emitted message validates against the vendored
 *     `agent_to_renderer.json` (+ common_types + the basic catalog).
 *  2. Structure: component ids are unique, and every child reference
 *     resolves — the flat-tree invariants the schema alone cannot state.
 *  3. Drift: output matches the committed golden files, so a mapper change
 *     shows up in review as a surface diff, never silently.
 */
import { build } from 'esbuild';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const specDir = join(root, 'spec', 'a2ui', 'v1_0');
const fixtureDir = join(root, 'spec', 'a2learn', 'fixtures');
const update = process.argv.includes('--update');

// --- load the mapper (TS, with @/ aliases) via a throwaway esbuild bundle ---
const bundle = await build({
  entryPoints: [join(root, 'src', 'lib', 'a2learn', 'a2ui.ts')],
  bundle: true,
  format: 'esm',
  write: false,
  tsconfig: join(root, 'tsconfig.json'),
  logLevel: 'error',
});
const tmp = join(root, 'node_modules', '.a2learn-conformance.mjs');
writeFileSync(tmp, bundle.outputFiles[0].text);
const { toA2UISurface, A2UI_SUPPORTED_KINDS } = await import(pathToFileURL(tmp).href);

// --- assemble the validator from the vendored schemas ---
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const messageSchema = readJson(join(specDir, 'agent_to_renderer.json'));
const commonTypes = readJson(join(specDir, 'common_types.json'));
const basicCatalog = readJson(join(specDir, 'catalogs', 'basic', 'catalog.json'));

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(commonTypes);
ajv.addSchema(basicCatalog);
// `agent_to_renderer.json` refs `catalog.json#...` relative to its own $id;
// the surface's actual catalog is bound at runtime. Alias the basic catalog
// to that resolved URL so validation uses the catalog our surfaces target.
ajv.addSchema({ ...basicCatalog, $id: 'https://a2ui.org/specification/v1_0/catalog.json' });
const validate = ajv.compile(messageSchema);

// --- structural invariants the schema cannot express ---
function structuralProblems(message) {
  const problems = [];
  const components = message.createSurface?.components ?? [];
  const ids = new Set();
  for (const c of components) {
    if (ids.has(c.id)) problems.push(`duplicate component id: ${c.id}`);
    ids.add(c.id);
  }
  if (!ids.has('root')) problems.push("no 'root' component — createSurface implies Surface{child:'root'}");
  for (const c of components) {
    const refs = [
      ...(typeof c.child === 'string' ? [c.child] : []),
      ...(Array.isArray(c.children) ? c.children : []),
    ];
    for (const ref of refs) {
      if (!ids.has(ref)) problems.push(`${c.id} references missing component: ${ref}`);
    }
  }
  return problems;
}

// --- run every fixture ---
mkdirSync(fixtureDir, { recursive: true });
const specs = readdirSync(fixtureDir).filter((f) => f.endsWith('.spec.json'));
if (!specs.length) {
  console.error(`No fixtures in ${fixtureDir} — add <name>.spec.json widget specs.`);
  process.exit(1);
}

let failed = false;
const covered = new Set();

for (const file of specs) {
  const name = file.replace(/\.spec\.json$/, '');
  const spec = readJson(join(fixtureDir, file));
  const surface = toA2UISurface(spec, `a2learn-fixture-${name}`);

  if (!surface) {
    console.error(`✗ ${name}: kind "${spec.kind}" is not mapped (A2UI_SUPPORTED_KINDS: ${A2UI_SUPPORTED_KINDS.join(', ')})`);
    failed = true;
    continue;
  }
  covered.add(spec.kind);

  if (!validate(surface)) {
    console.error(`✗ ${name}: schema validation failed`);
    for (const err of validate.errors ?? []) console.error(`   ${err.instancePath} ${err.message}`);
    failed = true;
    continue;
  }

  const structural = structuralProblems(surface);
  if (structural.length) {
    console.error(`✗ ${name}: ${structural.join('; ')}`);
    failed = true;
    continue;
  }

  const goldenPath = join(fixtureDir, `${name}.surface.json`);
  const rendered = `${JSON.stringify(surface, null, 2)}\n`;
  if (update) {
    writeFileSync(goldenPath, rendered);
    console.log(`✓ ${name}: valid — golden updated`);
  } else {
    let golden = null;
    try {
      golden = readFileSync(goldenPath, 'utf8');
    } catch {
      console.error(`✗ ${name}: no golden surface — run \`pnpm conformance:update\` and commit it`);
      failed = true;
      continue;
    }
    if (golden !== rendered) {
      console.error(`✗ ${name}: surface drifted from golden — review, then \`pnpm conformance:update\``);
      failed = true;
      continue;
    }
    console.log(`✓ ${name}: schema-valid, structurally sound, matches golden`);
  }
}

// Every claimed kind must have at least one fixture — support is proven, not asserted.
for (const kind of A2UI_SUPPORTED_KINDS) {
  if (!covered.has(kind)) {
    console.error(`✗ A2UI_SUPPORTED_KINDS claims "${kind}" but no fixture covers it`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
