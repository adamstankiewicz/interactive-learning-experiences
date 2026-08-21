# a2learn — security, privacy, and accessibility considerations (draft v0)

Informative unless marked with RFC 2119 keywords. This spec targets
learners who are often children; these sections are not boilerplate.

## Security considerations

**The catalog is the trust boundary.** Activities are data resolved against
host-controlled catalogs; nothing in a conforming pipeline lets a surface
introduce executable code (see Producer/Renderer requirements in
[`conformance.md`](./conformance.md)). Any implementation change that lets
model- or publisher-authored content reach the page by another route is a
vulnerability, not a feature request.

**Two-tier distribution exists because the tiers have different threat
models.** Content-tier listings are inert data; the worst malicious content
can do is be pedagogically bad or offensive — a moderation problem.
Code-tier listings are a software supply chain aimed at classrooms —
extension-store rules apply (signed publishers, review before listing,
revocation). Registries MUST keep the tiers distinguishable end to end.

**Prompt injection has two doors here.** (1) Manifest text (titles,
summaries, catalog descriptions) is injected into composer/agent prompts by
consuming systems — registries SHOULD bound length and character repertoire,
and consumers SHOULD treat manifest text as content, not instructions.
(2) Learner-authored text travels in event payloads and surface context —
hosts MUST label it untrusted when it enters a model context.

**Embedded rendering** inherits the MCP Apps sandbox model (iframes, opaque
origins, host-mediated messaging). Hosts SHOULD NOT weaken that sandbox for
content-tier activities.

## Privacy considerations

**A `WidgetResult` stream is an education record.** Aggregated results and
data-model snapshots constitute student performance data; deployments in
US K-12 contexts inherit FERPA/COPPA-shaped obligations, and equivalents
elsewhere. The spec's division of responsibility:

- **Manifests and surfaces MUST NOT contain learner data.** Content and
  people never travel in the same artifact; registries index only content.
- **Event payloads SHOULD be data-minimal.** `detail` payloads SHOULD NOT
  carry direct identifiers; identity binding is the host's job, at the
  transport layer, under its own compliance regime.
- **Persistence is the deployer's obligation**, not the format's: hosts
  that store results own retention, deletion, and access rights. The
  format's contribution is separability — learner-keyed state is
  structurally distinct from content, so deletion can cascade cleanly.

**Generated content in front of minors.** `provenance.generated` exists so
consuming systems can require review gates for AI-generated activities.
Hosts serving minors SHOULD run a content-safety pass on generated
surfaces before first exposure; the reviewer-attestation mechanism lets a
trust layer make that check portable.

## Accessibility considerations

Interaction accessibility (keyboard operability, focus, ARIA state) is a
property of catalog components; structural accessibility (heading order,
landmarks, reduced motion, live-region announcements for injected content)
is a property of surfaces. Manifest `a11y` fields are **declarations** —
useful for filtering, honest only if attested. A trust layer MAY certify
them; a registry MUST NOT convert declarations into certifications on its
own authority. Language access is first-class: `lang` is required in
manifests so agents can filter honestly rather than assume English.
