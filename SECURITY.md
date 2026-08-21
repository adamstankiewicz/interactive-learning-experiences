# Security Policy

## Reporting a vulnerability

Please report vulnerabilities privately via
[GitHub private vulnerability reporting](https://github.com/adamstankiewicz/interactive-learning-experiences/security/advisories/new)
rather than opening a public issue. You should hear back within a week; fixes for
confirmed issues are prioritized ahead of feature work.

There is no bug bounty. Credit is given in release notes unless you ask otherwise.

## Supported versions

The project is pre-1.0: only the current `main` branch receives security fixes.

## Known limitations — read before deploying

This is an open prototype, and honesty beats reassurance:

- **There is no authentication yet.** Every route is public; identity is an
  anonymous browser-local id. Do not deploy an instance holding real student
  data — especially roster profiles, which can contain sensitive free-text
  accommodations — until auth lands. Track this in the roadmap before any
  classroom use beyond demos.
- **Model output is rendered from a fixed component registry**, never as
  executable code, and specs are schema-validated before rendering. This is the
  project's core trust boundary; changes that let model output reach the page
  by any other route are treated as vulnerabilities.
- **The MCP endpoint (`/api/mcp`) serves open CORS by design** (sandboxed
  iframes have an opaque origin). It exposes widget generation, not stored data.

## Scope

Self-hosted deployments run entirely on your own keys and infrastructure; the
project ships no telemetry back to anyone.
