# Weekly domain routine

The procedure the weekly Claude Code routine follows to keep the business
domain overlay of the map current (ADR 0040, amendment of 2026-10-23). It
runs with no human present: every step below is decided here, and anything
it cannot decide goes in the PR body as a question.

Inputs: `architecture/domains.json` (the probable half, edited here), the
files and imports the generator reads. Output: one PR to
`blocksuite-labre-main` from the branch `routine/domain-overlay`, never more
than one open at a time.

## Steps

1. Start from `origin/blocksuite-labre-main`. If an open PR from
   `routine/domain-overlay` exists, check that branch out and merge
   `origin/blocksuite-labre-main` into it; else create the branch from
   `origin/blocksuite-labre-main`. Then install with
   `yarn install --immutable` (Corepack may fail behind a proxy:
   `COREPACK_NPM_REGISTRY=https://registry.npmjs.org yarn install --immutable`).
2. `yarn architecture --domains` prints the report: files no rule matches,
   rules matching no file, import communities and the folders off their
   community's domain.
3. Read the map through the likeC4 MCP, over stdio only:
   `node scripts/likec4-mcp.mjs` lists the tools,
   `node scripts/likec4-mcp.mjs subgraph-summary '{"project":"blocksuite","elementId":"framework.std"}'`
   reads one element, `query-incomers-graph` / `query-outgoers-graph` its
   neighbours (always read `truncated`; `query-graph` caps at 100). Never
   start `likec4 mcp --http` or a port.
4. Edit `architecture/domains.json`, nothing else by hand:
   - give every unmatched file a rule: prefer a folder or a file-name prefix
     already covering siblings, read the file's header and imports when the
     name is not enough, and weight it across two domains when it truly
     serves both (weights are normalised per file); a rule with no weight
     (`{}`) marks technical ground no domain owns (UI kit, env, HTTP);
   - delete rules matching no file, unless listed under `validated`;
   - revisit a rule only on evidence (the community report, the file's
     imports, a renamed module); never touch a rule listed under
     `validated`, nor its weights;
   - a new domain only when a cluster of at least ten files fits none,
     described in one sentence; never rename or remove a domain (that is
     the reviewer's call, asked in the PR body).
5. `yarn architecture` regenerates `domain.c4` (and `code.c4` if the
   main branch moved). Then run, and list in the PR body with their
   result: `yarn architecture --check`,
   `node_modules/.bin/likec4 validate architecture`,
   `npx vitest run architecture-map` from `packages/affine/all`,
   `npx prettier --check architecture scripts`.
6. Commit `chore: weekly domain overlay` (conventional commit, no scope,
   no model name, no changeset: the map ships with the next release), push,
   open or update the PR to `blocksuite-labre-main`, assigned to
   and reviewed by `formicoidea`. No GitHub Actions run is needed or
   awaited (no CI credit): the local checks of step 5 are the gate.
7. PR body: the coverage line of the report, a table of the elements whose
   domains changed (before → after, with scores), the rules added, changed
   and removed with one reason each, the off-domain folders worth a look,
   and the questions for the reviewer. No change at all: open no PR and
   stop.

The reviewer validates a rule by adding its path to `validated` in the same
PR or a later one; the routine then leaves it alone.
