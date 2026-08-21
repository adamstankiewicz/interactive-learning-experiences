# Governance

This project began at the CodeAI AI-education hackathon as cross-organization
work, and it is run in that spirit: small, transparent, and open to
contributors from any organization — including ones that compete with each
other.

## Roles

- **Maintainer** — currently [@adamstankiewicz](https://github.com/adamstankiewicz).
  Maintainers review and merge changes, cut releases, and hold admin access.
- **Contributors** — anyone with a merged PR. Regular contributors who review
  others' work well are invited to become maintainers; two maintainers from
  different organizations is the explicit goal, not an accident to avoid.

## How decisions get made

- Ordinary changes: a PR and a maintainer review.
- Contract changes (anything a third party programs against — widget spec
  schemas, the catalog entry shape, API routes, persisted formats): open an
  issue describing the change and its migration story *before* the PR.
  These are the project's public API even pre-1.0.
- Disagreements: discussed in the open on the issue; the maintainer decides;
  the reasoning gets written down.

## Versioning

Pre-1.0, breaking changes are allowed and are documented in release notes.
Persisted data carries explicit version markers so old records stay readable.
Once packages publish to npm they follow semver, with breaking changes batched
and migration-noted.

## Certifying your contributions

By submitting a PR you certify the
[Developer Certificate of Origin](https://developercertificate.org/) — that you
wrote the contribution or otherwise have the right to submit it under the
project's Apache-2.0 license. `git commit -s` sign-off is welcome but not
enforced by tooling yet.
