## What & why

<!-- One or two sentences: the change, and the situation it improves.
     Reference the issue where this was discussed — substantial changes
     without prior discussion may be closed (see GOVERNANCE.md). -->

Resolves #

## Type of change

<!-- Check ONE. Needing two boxes usually means the PR wants to be split —
     smaller PRs review faster and revert cleaner. -->

- [ ] Bugfix
- [ ] New widget kind (thank you! — follow CONTRIBUTING.md "Adding a widget")
- [ ] New/changed seam implementation (standards source, storage adapter, transport)
- [ ] Contract change (anything third parties program against — needs a linked issue *first*)
- [ ] Docs
- [ ] Dependency upgrade
- [ ] Code quality / tests

## Breaking or contract changes

<!-- If a third party's integration or a persisted record behaves
     differently after this merges, write this section FOR THEM — what
     breaks, how to adapt, why it's worth it. It travels into release
     notes. Delete the section if nothing external changes. -->

## How it was verified

<!-- CI runs the gates; check what you ran, and say what you did beyond
     them: flows exercised, topics/grades generated against, which MCP
     host you rendered in. UI changes: screenshots, light and dark. -->

- [ ] `pnpm lint` and `rm -rf .next && npx tsc --noEmit`
- [ ] `pnpm test`
- [ ] `pnpm conformance` (if the A2UI mapper or fixtures changed)
- [ ] `pnpm mcp:build` and committed the shell (if anything reachable from widget components changed — a stale shell breaks every MCP host, and CI will catch it)
- [ ] New logic carries a test that fails without this PR

## Authorship

<!-- This project welcomes agent contributors. Whoever submits — human,
     agent, or pair — is responsible for understanding every line.
     Agents: follow AGENTS.md, and disclose here: which agent, what the
     human reviewed, and anything you were unsure about (uncertainty
     stated plainly beats confidence discovered in review). -->

- [ ] I understand every line of this diff
- [ ] Agent-assisted or agent-authored (disclosed above)
- [ ] No `package.json` / `pnpm-lock.yaml` changes, or this PR is about dependencies

<!-- By submitting, you certify the Developer Certificate of Origin
     (see GOVERNANCE.md): you have the right to contribute this under
     Apache-2.0. -->
