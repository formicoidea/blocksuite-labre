# Rendering a page to static HTML

`HtmlAdapter` prints a stored page with no DOM: Node, a serverless function, a
build step. `html-headless-blocks.unit.spec.ts` in `packages/affine/all` holds
that, in Vitest's `node` environment.

```ts
const workspace = new WorkspaceImpl({ id: workspaceId });
workspace.storeExtensions = new StoreExtensionManager(
  getInternalStoreExtensions()
).get('store');
workspace.meta.initialize();
const page = workspace.createDoc(docId);
Y.applyUpdate(page.spaceDoc, state);
const store = page.getStore({ id: docId });
store.load();

const job = store.getTransformer([
  docLinkBaseURLMiddleware(workspaceId),
  titleMiddleware(metas),
]);
const adapter = new HtmlAdapter(job, store.provider);
const { file, assetsIds } = await adapter.fromDocSnapshot({
  snapshot: job.docToSnapshot(store)!,
});
```

The matchers register through `./extensions/store`, so that entry is the cost of
the render path whichever adapter entry you import. A one-shot script calls
`process.exit` when done: timers stay active after `workspace.dispose()`.

## What the host owns

**Assets.** The output links blobs by a relative path and `assetsIds` lists them.
Rewrite `assets/` to wherever you serve them.

| Call                                | Image `src`                 | Reads blobs |
| ----------------------------------- | --------------------------- | ----------- |
| No `assets` (above)                 | `assets/<blobId>`           | No          |
| `assets: job.assetsManager`         | `assets/<blobId>.<ext>`     | Yes         |
| `assets`, and the blob is a `File`  | `assets/<file name>`        | Yes         |
| `assets`, and the blob is not found | `assets/<blobId>` (logs it) | Tried       |

An attachment never reads its blob: `assets/<blobId>`, or the image naming above
when something already read it. Its link is therefore dead in the zip of the HTML
export, which only packs what was read.

**Links.** `docLinkBaseURLMiddleware` prints `./workspace/<workspaceId>/<docId>`.
Rewrite those to your routes, or pass your own base with
`docLinkBaseURLMiddlewareBuilder`.

**The canvas.** `affine:surface` and what sits on it print nothing: a page shows
its page view. An `affine:surface-ref` prints
`<div class="affine-surface-ref" data-labre-surface-ref="<id>">` with its caption
inside, for you to mount a viewer on or leave as is.

**Formulas.** KaTeX prints HTML and MathML. Load `katex/dist/katex.min.css` on the
page, or the formula shows twice.

**Styles.** The classes are hooks with no stylesheet: `affine-callout`,
`affine-callout-icon`, `affine-latex`, `affine-attachment`, `affine-surface-ref`,
`affine-edgeless-text`, `affine-embed-html`, `affine-unknown-block`.

## What never reaches the page

- The stored `html` of an `affine:embed-html`: only its caption prints.
- A `javascript:` URL on an inline link or an embed: the text stays, the `href`
  goes.
- A block flavour no matcher knows does not vanish and does not throw: it prints
  `<div class="affine-unknown-block" data-flavour="…">` with its title or text,
  and keeps its children.
