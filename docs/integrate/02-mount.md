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
reading from.

## Frameworks other than Lit

The container is a custom element. From React, render `<my-editor-container>`
in a `ref`-ed div, set its properties in an effect, and load the module
lazily so it never runs on the server. Vue and Svelte work the same way. No
first-party React wrapper exists.

Next: [03-flags.md](03-flags.md).
