# Governance

This project began at the CodeAI AI-education hackathon as cross-organization
work, and it is run in that spirit: small, transparent, and open to
contributors from any organization — including ones that compete with each
other.

## Roles

- **Maintainers** — the project was built by a cross-organization hackathon
  team, and its maintainer group is forming from that team rather than
  defaulting to one person. Ongoing maintainership is honestly not settled
  yet; this file is updated as people commit to the role, and membership is
  a named entry here plus CODEOWNERS, not an informal understanding.
  Maintainers review and merge changes, cut releases, and hold admin access.
- **Repository admin** — currently
  [@adamstankiewicz](https://github.com/adamstankiewicz), because the repo
  lives under a personal account until it transfers to a neutral
  organization (see the roadmap's governance gate). Admin is plumbing, not
  authority: decisions follow the process below regardless of whose account
  hosts the code.
- **Contributors** — anyone with a merged PR. Regular contributors who review
  others' work well are invited to become maintainers; maintainers from at
  least two different organizations is the explicit goal, not an accident to
  avoid.

## How decisions get made

- Ordinary changes: a PR and a maintainer review.
- Contract changes (anything a third party programs against — widget spec
  schemas, the catalog entry shape, API routes, persisted formats): open an
  issue describing the change and its migration story *before* the PR.
  These are the project's public API even pre-1.0.
- Disagreements: discussed in the open on the issue; the maintainers decide
  (the repository admin breaks a tie only when there is no other way to move);
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
