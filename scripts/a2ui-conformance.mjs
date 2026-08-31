/**
 * A2UI conformance: prove the boundary mapper's output against Google's own
 * v1.0 schemas, not against our opinion of them.
 *
 *   pnpm conformance           validate fixtures + compare golden surfaces
 *   pnpm conformance:update    regenerate the golden surfaces
 *
 * Four layers of checking, strictest first:
 *  1. Input: every fixture spec must parse against the app's real widget
 *     schema (zod) — the gate proves the mapper handles specs the pipeline
 *     can actually produce, not hand-written fiction.
 *  2. Schema: every emitted message validates against the vendored
 *     `agent_to_renderer.json` (+ common_types + the basic catalog), and
 *     must declare the exact catalog it was validated against.
 *  3. Structure: component ids are unique, and every child reference —
 *     including the template form — resolves; the flat-tree invariants the
 *     schema alone cannot state.
 *  4. Drift: output matches the committed golden files, so a mapper change
 *     shows up in review as a surface diff, never silently.
 */
import { build } from 'esbuild';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// The spec schemas come from @a2ui/web_core — the A2UI project's own
// publication, pinned exactly in package.json; the lockfile's integrity
// hash is the checksum. Nothing of the upstream spec is committed here,
// and our surfaces target the *released* revision, because interop is
// with shipped renderers, not with the spec repo's HEAD.
const specDir = join(root, 'node_modules', '@a2ui', 'web_core', 'src', 'v1_0', 'schemas');
const fixtureDir = join(root, 'spec', 'a2learn', 'fixtures');
const update = process.argv.includes('--update');

// --- load the mapper AND the widget schema via one in-memory bundle ---
const bundle = await build({
  stdin: {
    contents: `
      export { toA2UISurface, A2UI_SUPPORTED_KINDS, A2UI_BASIC_CATALOG } from '@/lib/a2learn/a2ui';
      export { widgetSpec } from '@/lib/pathway/schema';
    `,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  write: false,
  tsconfig: join(root, 'tsconfig.json'),
  logLevel: 'error',
});
// Imported from a data URL — nothing written to disk, nothing to clean up,
// and two concurrent runs cannot read each other's bundle.
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`;
const { toA2UISurface, A2UI_SUPPORTED_KINDS, A2UI_BASIC_CATALOG, widgetSpec } = await import(moduleUrl);

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
// to that resolved URL so validation uses the catalog our surfaces target —
// and because the alias makes validation catalog-blind, layer 2 separately
// asserts each surface *declares* the catalog it was validated against.
ajv.addSchema({ ...basicCatalog, $id: 'https://a2ui.org/specification/v1_0/catalog.json' });
const validate = ajv.compile(messageSchema);

// --- negative controls: prove each layer can reject before trusting green ---
// The $id alias above is exactly the plumbing that could silently vacuate
// validation; these fail-closed checks run every time, not just in review.
// Empirical note: the upstream schema accepts a createSurface with no
// components at all — only the structural layer catches that, which is why
// both layers get their own control here.
if (validate({})) {
  console.error('✗ negative control: schema validator accepted an empty message — validation is vacuous');
  process.exit(1);
}
if (validate({ createSurface: { surfaceId: 's', catalogId: 'c', components: [{ bogus: true }] } })) {
  console.error('✗ negative control: schema validator accepted a malformed component — validation is vacuous');
  process.exit(1);
}

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
    const refs = [];
    if (typeof c.child === 'string') refs.push(c.child);
    if (Array.isArray(c.children)) refs.push(...c.children);
    // ChildList's template form: { componentId, path } — the componentId is
    // a reference too, and a typo there is exactly the silent-empty-list bug
    // this layer exists to catch.
    if (c.children && !Array.isArray(c.children) && typeof c.children === 'object') {
      if (typeof c.children.componentId === 'string') refs.push(c.children.componentId);
    }
    // Tabs nest their child refs one level down: tabs[].child.
    if (Array.isArray(c.tabs)) {
      for (const tab of c.tabs) {
        if (tab && typeof tab.child === 'string') refs.push(tab.child);
      }
    }
    for (const ref of refs) {
      if (!ids.has(ref)) problems.push(`${c.id} references missing component: ${ref}`);
    }
  }
  return problems;
}

// Structural layer: a duplicate id, a dangling child ref, and a missing root
// must all be reported, or layer 3 is a no-op wearing a checkmark.
{
  const problems = structuralProblems({
    createSurface: {
      components: [
        { id: 'a', child: 'ghost' },
        { id: 'a' },
        { id: 'b', tabs: [{ title: 'T', child: 'tab-ghost' }] },
      ],
    },
  });
  const wants = ['duplicate component id', 'missing component: ghost', 'missing component: tab-ghost', "no 'root'"];
  if (!wants.every((w) => problems.some((p) => p.includes(w)))) {
    console.error(`✗ negative control: structural checker missed known defects (got: ${problems.join('; ') || 'nothing'})`);
    process.exit(1);
  }
}

// Input layer: the zod gate must reject a spec the pipeline could never produce.
if (widgetSpec.safeParse({ kind: 'no-such-kind' }).success) {
  console.error('✗ negative control: widgetSpec accepted an unknown kind — the fixture gate is open');
  process.exit(1);
}

// --- run every fixture ---
let failed = false;
const covered = new Set();

function fail(name, msg) {
  console.error(`✗ ${name}: ${msg}`);
  failed = true;
}

const specs = readdirSync(fixtureDir).filter((f) => f.endsWith('.spec.json'));
if (!specs.length) {
  console.error(`No fixtures in ${fixtureDir} — add <name>.spec.json widget specs.`);
  process.exit(1);
}

for (const file of specs) {
  const name = file.replace(/\.spec\.json$/, '');
  const spec = readJson(join(fixtureDir, file));

  // Layer 1: the fixture must be a spec the pipeline could actually produce.
  const parsed = widgetSpec.safeParse(spec);
  if (!parsed.success) {
    fail(name, `fixture is not a valid widget spec: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
    continue;
  }

  const surface = toA2UISurface(parsed.data, `a2learn-fixture-${name}`);

  if (!surface) {
    fail(name, `kind "${spec.kind}" is not mapped (A2UI_SUPPORTED_KINDS: ${A2UI_SUPPORTED_KINDS.join(', ')})`);
    continue;
  }
  covered.add(spec.kind);

  // Layer 2: upstream schema validity, plus the catalog binding the alias
  // above cannot check.
  if (!validate(surface)) {
    fail(name, 'schema validation failed');
    for (const err of validate.errors ?? []) console.error(`   ${err.instancePath} ${err.message}`);
    continue;
  }
  if (surface.createSurface.catalogId !== A2UI_BASIC_CATALOG) {
    fail(name, `catalogId "${surface.createSurface.catalogId}" is not the catalog this suite validates against`);
    continue;
  }

  // Layer 3.
  const structural = structuralProblems(surface);
  if (structural.length) {
    fail(name, structural.join('; '));
    continue;
  }

  // Layer 4.
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
      fail(name, 'no golden surface — run `pnpm conformance:update` and commit it');
      continue;
    }
    if (golden !== rendered) {
      fail(name, 'surface drifted from golden — review, then `pnpm conformance:update`');
      continue;
    }
    console.log(`✓ ${name}: spec-valid, schema-valid, structurally sound, matches golden`);
  }
}

// Every claimed kind must have at least one fixture — support is proven, not asserted.
for (const kind of A2UI_SUPPORTED_KINDS) {
  if (!covered.has(kind)) {
    fail('coverage', `A2UI_SUPPORTED_KINDS claims "${kind}" but no fixture covers it`);
  }
}

process.exit(failed ? 1 : 0);
