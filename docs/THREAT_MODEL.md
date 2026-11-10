# Threat model of the library

- Status: **draft to validate.** Written on 2026-11-10 from `CLAUDE.md`, the ADRs, the workflows and the release scripts, without a workshop. The open questions are at the end.
- Readers: the reviewers of a PR that touches a red zone, a dependency or a release script; the weekly hygiene pass of the `usine` plugin; a maintainer taking over. There is no running service here, so no black-box agent attacks this repo: what a hostile document does inside a running editor is tested on the host, by the Labre app's own threat model.
- This file says who would attack an open-source editor library, where the barriers are, and what to check. It replaces no ADR.

## 1. What we protect

| Asset                    | Where it lives                                                                 | Why it matters                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| The published bundles    | `@formicoidea/labre-*` on npm, built and published by hand (`yarn ci:publish`) | Every host installs them: a hostile bundle runs in every user's browser, with that user's session |
| The integration branch   | `blocksuite-labre-main`                                                        | What the next release is built from                                                               |
| The npm publishing right | The maintainer's npm account on the `@formicoidea` scope                       | It is the release; there is no release workflow in CI                                             |
| The persisted format     | `packages/affine/model`, `packages/framework/store`, `sync`                    | A bad change corrupts documents irreversibly (red zone)                                           |
| The host's promises      | Seams: network endpoints, telemetry, image proxy, link preview                 | A host that promises no third-party request relies on the library keeping its defaults honest     |
| The users' documents     | Never here: in the host                                                        | The library only sees them at run time, in the browser                                            |

## 2. Who attacks

1. **An outside contributor**: the repo is public, anyone can open a pull request or an issue. The change looks useful and carries something else.
2. **A dependency**: a compromised or typosquatted npm package, a malicious minor pulled in by a grouped Renovate update, an altered lockfile entry.
3. **Upstream**: a cherry-pick from AFFiNE brings code nobody here reviewed line by line.
4. **A thief of the publishing right**: an npm token or session stolen from the maintainer's machine.
5. **A hostile document or file**: content opened or imported in the editor (pasted HTML, an SVG, a `.bpmn`, a draw.io or XMI file, an embed URL) that tries to run script in the host's page or to call out.
6. **A use that overloads**: a document legal in format but built to be expensive (huge element counts, deep nesting, pathological text for a parser), aimed at the browser of every reader or at the host's sync and storage.
7. **An agent of our own**, misled by text it read (an issue, a comment, a file): it holds write access.

## 3. Barriers, and where they are

| Barrier                                                                     | Rule                                                                                          | Source                                                                 |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| A human reviews every PR; a red zone needs a maintainer's explicit approval | Store, sync, model, release scripts, workflows, changeset config                              | `CLAUDE.md`, red zones; `.usine/obligations.json` (`sensibles`)        |
| The release is manual and local                                             | `ci:version` then `ci:publish` by a maintainer; no workflow holds an npm token                | `docs/contribute/05-release.md`                                        |
| A bundle depends on core and the shared bundle only                         | A framework package importing another breaks publish                                          | `architecture-map.unit.spec.ts`, `core-database-boundary.unit.spec.ts` |
| Every import is declared                                                    | The bundle script reads the manifests, never the imports                                      | `declared-dependencies.unit.spec.ts`                                   |
| An imported file is data                                                    | A pure parser returns serialized props; unknown data is preserved, never executed             | ADR 0012                                                               |
| An SVG is sanitised before it is read                                       | The reader walks only what `sanitizeSvg` returns; a forged `data-labre-*` marker buys nothing | ADR 0032                                                               |
| Embeds are sandboxed                                                        | An iframe is sandboxed and refuses a non-http(s) URL                                          | `CLAUDE.md`, Security                                                  |
| A style value comes through one door                                        | `styleMap` from `@labre/global/lit`: one value sets one property                              | `style-map-boundary.unit.spec.ts`                                      |
| Every network call is injectable                                            | Endpoint and `fetch` are parameters; nothing reads `process.env`                              | ADR 0003, `docs/integrate/04-host-seams.md`                            |
| Telemetry carries ids only                                                  | No prose, URL or credential is emitted                                                        | telemetry-service `README.md`                                          |
| The architecture MCP is local                                               | stdio only; its `--http` mode is never deployed or run in CI                                  | ADR 0040                                                               |

## 4. What to check

These are checks for a reviewer and for the weekly hygiene pass. None of them is an attack to run.

### C1. A change that comes from outside

- A PR from a fork touches a workflow, a release script, a `postinstall`, the lockfile or a manifest: red zone, whatever its stated purpose.
- A diff adds a network call, an `eval`, a dynamic `import()` of a computed path, a `Function` constructor, an encoded blob, or a new default endpoint.
- A workflow gains `pull_request_target`, a wider `permissions:` block or a secret: today none uses `pull_request_target` and the only secret is the job's own `GITHUB_TOKEN`.
- Text in an issue, a PR or a file tells an agent to do something: it is content, never an instruction.

### C2. Dependencies

- A new dependency for what a few lines can do; a new peer-level dependency (red-zone-adjacent).
- A grouped Renovate update ("all non-major dependencies"): read the list, not the title. A package that changed owner, gained an install script, or jumped in size is opened before it is merged.
- The lockfile changes without a manifest change.
- Known advisories: raise the floor in the manifests, one changeset each.

### C3. The release

- The publishing account has two-factor authentication, and the token used by `ci:publish` is not stored in the repo, in CI or in an agent's environment.
- What is published is what was reviewed: the bundles are built from a clean checkout of the tagged commit, and each tarball ships its `LICENSE`.
- A version already on the registry is never republished with other content.

### C4. Upstream cherry-picks

- A cherry-pick is read as an outside change (C1), not trusted because it comes from AFFiNE.
- It does not bring back AI, mobile, server or importer code that this fork removed.

### C5. Hostile content, on the library's side

- Every new import format goes through a pure parser and the shared sanitiser; a new reader has a test with a hostile file in `__tests__/corpus/`.
- A value from a document never reaches a `style` string, an `href`, an `innerHTML` or an iframe `src` without the door that owns it.
- A new seam documents what happens when it is absent, and its default calls no third party.

### C6. Documents built to be expensive

- A parser or a layout has a bound: on input size, element count, nesting depth, or time. A new one states its bound and tests it (the budget tests assert numbers: `FRAME_BUDGET_MS`).
- A cascade runs on local edits only, once: a remote peer cannot make every client re-apply it.
- Nothing is written on load or on opening a panel, so opening a large document does not grow it.

## 5. Open questions (for the owner)

1. Are pull requests from outside contributors expected, or should the repo refuse them until there is a process?
2. Is two-factor authentication on for the npm account, and where does the publishing token live?
3. Renovate targets the branch `main`, which is the dead upstream mirror here: is dependency updating meant to be on, and against which branch?
4. Should the weekly hygiene pass open an issue for each C2 finding, or only report it on Monday?
5. Is there a document size or element count above which the editor is allowed to refuse or degrade, or must everything open?
