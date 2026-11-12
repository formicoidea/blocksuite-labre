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
`<div class="affine-surface-ref" data-labre-surface-ref="<id>" data-labre-surface-ref-type="frame|group">`
holding `span.affine-surface-ref-title` (the frame's or group's title, read from
the page's own surface) and `span.affine-surface-ref-caption`, each only when
there is text, for you to mount a viewer on or leave as is. The viewer is
`mountCanvasViewer(host, state, options)` from `@labre/affine/canvas-viewer`
(ADR 0050): load it with a dynamic `import()` on a page that holds a canvas, it
weighs the whole view graph.

**The viewer under a strict policy.** The viewer holds under a policy with no
`'unsafe-inline'` style (attribute or element) and no `'wasm-unsafe-eval'`,
such as `default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'`
(ADR 0050, ADR 0051). You call nothing for it: importing
`@labre/affine/canvas-viewer` calls `adoptShadowlessStyles()` (`@labre/affine/std`) and
`adoptEmotionStyles()` (`@labre/affine/shared/styles`) while the modules
evaluate, so the library's styles go to `document.adoptedStyleSheets` and no
`<style>` is created, and the viewer highlights code with
`CodeBlockConfig.engine: 'javascript'`, not WebAssembly. What the policy still
needs from you: `script-src` for the viewer's own chunks (shiki loads each
language with a dynamic `import()`), `style-src` for the CSS your bundler
extracts from the `.css.ts` files, `font-src` for the faces you declare (the
viewer registers no font list: the canvas paints with the faces the page has,
and paints again each time `document.fonts` finishes loading, so a face that
arrives after the mount still reaches the text),
and `img-src blob:` for the images `getBlob` returns. Two kinds of report
remain, neither visible: one `style-src-attr` per icon (the `style` string
`@blocksuite/icons` binds, whose declarations the viewer's sheet carries) and
one `img-src` (the `data:` drag image `@atlaskit/pragmatic-drag-and-drop`
preloads, never used on a read-only page). Those sheets are global to
the document and come after its `<style>` and `<link>` in the cascade, with the
library's selectors scoped to its own classes: import the viewer on a page that
does not also run the editor, whose cascade order they would change.

To mount the editor itself under such a policy, call the two functions at the
top level of the module that imports the editor, before its first render, and
register `CodeBlockConfigExtension({ engine: 'javascript' })` (`@labre/affine/blocks/code`).
`adoptEmotionStyles()` called later still works, but emotion has then created
its `<style>` once, which the policy reports. The editor keeps `<style>`
elements as long as nothing calls them.

**Callouts and bookmarks.** A callout prints `div.affine-callout[data-emoji]`
with `span.affine-callout-emoji` then `div.affine-callout-body` (its own line as
a `<p>`, then its child blocks). A bookmark prints `a.affine-bookmark[rel=noopener]`
from the metadata stored with the link, never fetched: `span.affine-bookmark-title`
(the URL when no title was stored), `span.affine-bookmark-description` and
`span.affine-bookmark-host`, the favicon URL on `data-icon` when there is one.

**Formulas.** KaTeX prints HTML and MathML. Load `katex/dist/katex.min.css` on the
page, or the formula shows twice.

**Styles.** The classes are hooks with no stylesheet: `affine-callout`,
`affine-callout-emoji`, `affine-callout-body`, `affine-bookmark` (and its `-title`,
`-description`, `-host`), `affine-latex`, `affine-attachment`, `affine-surface-ref`
(and its `-title`, `-caption`), `affine-edgeless-text`, `affine-embed-html`,
`affine-unknown-block`.

## What never reaches the page

- The stored `html` of an `affine:embed-html`: only its caption prints.
- A `javascript:` URL on an inline link or an embed: the text stays, the `href`
  goes.
- A block flavour no matcher knows does not vanish and does not throw: it prints
  `<div class="affine-unknown-block" data-flavour="…">` with its title or text,
  and keeps its children.
