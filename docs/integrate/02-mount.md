# Mount the editor

**Workspace, then document, then extensions, then a container element you
own. Tear it all down in one `dispose()`.**

The library ships no editor chrome. Like AFFiNE, the host owns the container
element; the library provides the runtime (`BlockStdScope`) and the
extensions. The playground's container lives in a private test package on
purpose: copy the pattern, not the package.

## 1. The workspace

```ts
import { Schema, WorkspaceImpl } from '@labre/affine/store';
import { StoreExtensionManager } from '@labre/affine/ext-loader';
import { getAffineSchemas } from '@labre/affine/schemas';
import { getInternalStoreExtensions } from '@labre/affine/extensions/store';

const schema = new Schema();
schema.register(getAffineSchemas());

const workspace = new WorkspaceImpl({
  id: 'my-app',
  // docSources, blobSources, awarenessSources: see 05-persistence-and-sync.md
});
workspace.storeExtensions = new StoreExtensionManager(
  getInternalStoreExtensions()
).get('store');
workspace.start();
workspace.meta.initialize(); // only if you have nothing persisted to hydrate first
```

`WorkspaceImpl` creates its own root `Y.Doc` and inert in-memory sync engines
by default. Never import from `@labre/affine/store/test` in production.

## 2. The document

```ts
import { Text } from '@labre/affine/store';

const doc = workspace.createDoc('doc-1'); // or workspace.getDoc('doc-1')
const store = doc.getStore({ id: 'doc-1' });
doc.load(() => {
  // seed an empty document once
  if (store.root) return;
  const rootId = store.addBlock('affine:page', { title: new Text('Untitled') });
  store.addBlock('affine:surface', {}, rootId);
  const noteId = store.addBlock('affine:note', {}, rootId);
  store.addBlock('affine:paragraph', {}, noteId);
});
```

## 3. The view extensions

```ts
import { ViewExtensionManager } from '@labre/affine/ext-loader';
import { getInternalViewExtensions } from '@labre/affine/extensions/view';
import { wardleyFramework } from '@labre/framework-wardley/descriptor';
import { NoopTelemetryExtension } from '@labre/affine/shared/services';

const flags = { database: false }; // see 03-flags.md

const frameworkExtensions = [wardleyFramework]
  .flatMap(f => f.extensions)
  .filter(e => !('flag' in e) || flags[e.flag] !== false)
  .map(e => e.viewExtension);

const view = new ViewExtensionManager([
  ...getInternalViewExtensions(flags),
  ...frameworkExtensions,
]);

const hostExtensions = [NoopTelemetryExtension /* , … see 04-host-seams.md */];
const pageSpecs = [...view.get('page'), ...hostExtensions];
const edgelessSpecs = [...view.get('edgeless'), ...hostExtensions];
```

A framework descriptor has the shape
`{ flag, telemetryKey, extensions: [{ viewExtension }, { flag, viewExtension }] }`.
The first entry (the renderer) is always registered. The second (the
tooling) is registered unless its flag is `false`.

## 4. The container element

A minimal Lit element that builds a `BlockStdScope` from the store and the
specs of the current mode, and renders it:

```ts
import { BlockStdScope, ShadowlessElement } from '@labre/affine/std';
import { SignalWatcher, WithDisposable } from '@labre/affine/global/lit';
import { ThemeProvider } from '@labre/affine/shared/services';
import type { DocMode } from '@labre/affine/model';
import type { ExtensionType, Store } from '@labre/affine/store';
import { computed, signal } from '@preact/signals-core';
import { html } from 'lit';
import { keyed } from 'lit/directives/keyed.js';

export class MyEditorContainer extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  store!: Store;
  pageSpecs: ExtensionType[] = [];
  edgelessSpecs: ExtensionType[] = [];

  private readonly _mode = signal<DocMode>('page');
  private readonly _std = computed(
    () =>
      new BlockStdScope({
        store: this.store,
        extensions:
          this._mode.value === 'page' ? this.pageSpecs : this.edgelessSpecs,
      })
  );

  get std() {
    return this._std.value;
  }
  switchEditor(mode: DocMode) {
    this._mode.value = mode;
  }

  override render() {
    const mode = this._mode.value;
    const theme = this.std.get(ThemeProvider);
    return html`${keyed(
      this.store.root?.id + mode,
      html`<div
        data-theme=${mode === 'page' ? theme.app$.value : theme.edgeless$.value}
        class=${mode === 'page'
          ? 'affine-page-viewport'
          : 'affine-edgeless-viewport'}
      >
        ${this.std.render()}
      </div>`
    )}`;
  }
}

customElements.define('my-editor-container', MyEditorContainer);
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());
```

The `keyed` directive forces a fresh subtree when the mode changes. The
`data-theme` attribute is what the library's CSS variables key on. The HMR
line avoids "illegal constructor" after a hot update (see
[lessons.md](../lessons.md)).

The full reference container, with the page viewport CSS and the
`<doc-title>` fragment, is
`packages/integration-test/src/editors/editor-container.ts`.

### The box model

The library is drawn in the border box: a width includes its padding and
border. It does not ask the host for a global `* { box-sizing: border-box }`
reset; it sets the border box on its own roots:

- `editor-host` and everything inside it (std's `EditorHost`), which covers
  the blocks, their widgets and the menus portaled into the editor;
- `affine-menu` and everything inside it, for a menu portaled to the body.

What stays the host's:

- its own elements outside `editor-host` (the chrome around the editor, a
  panel the host draws), sized as the host's CSS decides;
- a portal rendered into a shadow root (`createLitPortal` with `shadowDom`):
  a light-DOM rule does not reach it, so its component sets its own box.

A host with a global reset changes nothing. A host without one gets the same
layout as the playground, which is the reference (labre recette of 2.1: a
page root overflowing by its gutters and a menu field past its menu came
from a host without that reset).

## 5. Mount and dispose

```ts
const editor = new MyEditorContainer();
editor.store = store;
editor.pageSpecs = pageSpecs;
editor.edgelessSpecs = edgelessSpecs;
host.append(editor);

return () => {
  editor.remove(); // the std scope and its container die with the element
  // then dispose your persistence, realtime, presence…
};
```

Order matters: remove the editor first, then close the channels it was
reading from. When the workspace itself goes, call `workspace.dispose()`:
its awareness runs an interval that keeps the workspace, every store
opened from it and their blocks reachable until it is cleared. An editor
removed from a workspace that stays open is not kept by it (the canvas
surface used to keep the last editor mounted on each document).

### Closing and reopening a document

The STORE of a document is another matter: a workspace that stays open keeps
one store per document opened in it, until you release it
([ADR 0057](../adr/0057-store-release-and-eviction.md)).

- **Reuse the store across mounts.** `doc.getStore()` with no argument (or
  `{ id: docId }`) returns the same store for a document every time; mount
  each new editor on it. The undo history lives in the store, so it
  survives the remount, a mode switch and a route change. Do not release a
  store between two mounts of the same document.
  `getStore({ readonly: false })` is another store, one per document (its
  own selection and history), kept apart so that toggling the default
  store's local `readonly` does not reach it; ask for it only if you need
  that.
- **Close a document for good with `store.dispose()`**, after its last
  editor is unmounted. It detaches everything the store attached to the
  document and to the awareness, and the workspace forgets it: the next
  `doc.getStore()` builds a new store from the document, live, which sees
  everything peers wrote meanwhile. Nothing stored is lost or written:
  every edit is in Yjs when the call that made it returns, and the
  block-meta writer defers nothing. What goes is what lived in memory: the
  undo and redo stacks (a reopened document starts with an empty history),
  the local selection (peers stop seeing it), the store's local `readonly`
  toggle, and every subscription to its slots and signals (subscribe again
  on the new store). Calling it twice does nothing; `removeStore` after it
  is not needed.
- **A disposed store is a dead object.** `load()` and every write through
  it (`addBlock`, `addBlocks`, `addSiblingBlocks`, `updateBlock`,
  `deleteBlock`, `moveBlocks`, `transact`, `withoutTransact`, `undo`,
  `redo`) throw a `BlockSuiteError` (`ErrorCode.ModelCRUDError`); reads
  answer its last state, so teardown code that reads still works. Drop
  your references to it and open the document again with
  `doc.getStore()`.
- **A preview built on a query store** (`doc.getStore({ query })`) is
  released the same way once the preview is gone. Previews asking for the
  same options share one cached store: hold it with `holdPreviewStore(doc,
options)` from `@labre/affine-shared/utils` and call `release()` when
  yours goes; the last release disposes of it. The library's own previews
  (drag image, linked-doc card, frame card, surface-ref note) do.
- **A store you never dispose of stays** for the workspace's life, one per
  document opened (the cache is the point: the growth follows documents,
  not mounts). `workspace.dispose()` frees them all, once you also drop
  your references.
- **Never call `doc.dispose()` to close a document.** It clears the
  document's blocks in Yjs, and the deletion syncs to every peer and to
  storage. It is what deleting a document does.

The retained cost is measured in
`packages/integration-test/src/__tests__/edgeless/store-retention.spec.ts`:
a disposed store is collected. A document opened, edited (one shape) and
closed that way still costs about 11 KB of JS heap, its own Yjs content
among it, which the workspace's root document keeps while the workspace is
open (69-80 KB before ADR 0057).

## Frameworks other than Lit

The container is a custom element. From React, render `<my-editor-container>`
in a `ref`-ed div, set its properties in an effect, and load the module
lazily so it never runs on the server. Vue and Svelte work the same way. No
first-party React wrapper exists.

Next: [03-flags.md](03-flags.md).
