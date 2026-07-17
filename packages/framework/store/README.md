# `@labre/store`

BlockSuite data store built for general purpose state management. Used in [AFFiNE](https://affine.pro/).

## Creating a workspace

`WorkspaceImpl` is the public production `Workspace`. It is self-contained: it
creates its own root `Y.Doc` and, by default, in-memory no-op sync engines.

```ts
import { WorkspaceImpl } from '@labre/store';

const workspace = new WorkspaceImpl({ id: 'my-workspace' });
workspace.storeExtensions = [
  /* your block schema + service extensions */
];
workspace.start();

// docs
const doc = workspace.createDoc('doc-0'); // or workspace.getDoc('doc-0')
const store = doc.getStore();
store.load(() => {
  /* seed initial blocks here, if any */
});
```

### Persistence & sync

The default engines do **not** persist or sync anything — wire that yourself on
the exposed `Y.Doc`s, which is where a host app plugs its storage/realtime
layer:

- `workspace.doc` — the root `Y.Doc` (workspace corpus / doc list metadata).
- `workspace.getDoc(id).spaceDoc` — a page doc's `Y.Doc`.

```ts
// e.g. autosave + hydrate on the root doc
workspace.doc.on('update', update => storage.push(meta.id, update));
Y.applyUpdate(workspace.doc, await storage.load(meta.id));

// call meta.initialize() after hydration so it does not clobber persisted state
workspace.meta.initialize();
```

Alternatively, pass real `docSources` / `blobSources` to the constructor to use
the built-in `DocEngine` / `BlobEngine` instead of external wiring.

> `TestWorkspace` (from `@labre/store/test`) is an independent, test-only
> sibling with the same surface — do not use it in production.

## Documentation

Checkout [blocksuite.io](https://blocksuite.io/) for comprehensive documentation.
