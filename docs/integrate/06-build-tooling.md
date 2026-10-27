# Build tooling

**Vite plus vanilla-extract, no server rendering, one hot-reload line, one
Vitest setting.**

## Vite and vanilla-extract

The library ships its styles as vanilla-extract `.css.ts` files. Register the
plugin:

```ts
// vite.config.ts
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
export default defineConfig({ plugins: [vanillaExtractPlugin()] });
```

In dev, Vite's dependency pre-bundler (esbuild) does not run the plugin, so
`.css.ts` files inside `node_modules` execute with no file scope and styles
break with "Styles were unable to be assigned to a file". Excluding the
packages from optimization strands their CommonJS dependencies. The fix that
works is to keep every `.css.ts` file external to the pre-bundle:

```ts
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin as EsbuildPlugin } from 'esbuild';

const externalizeVanillaExtract = (): EsbuildPlugin => ({
  name: 'externalize-vanilla-extract',
  setup(build) {
    build.onResolve({ filter: /\.css(\.[jt]s)?$/ }, args => {
      if (args.kind === 'entry-point' || !args.path.startsWith('.'))
        return null;
      const base = resolve(args.resolveDir, args.path);
      const veFile = /\.css\.[jt]s$/.test(base)
        ? base
        : [`${base}.ts`, `${base}.js`].find(existsSync);
      if (!veFile || !existsSync(veFile)) return null;
      return { path: veFile, external: true };
    });
  },
});

export default defineConfig({
  plugins: [vanillaExtractPlugin()],
  optimizeDeps: { esbuildOptions: { plugins: [externalizeVanillaExtract()] } },
});
```

Production builds (Rollup) are unaffected.

## Hot module replacement

A custom element class cannot be redefined. When Vite re-evaluates the module
that defines your container, `new MyContainer()` throws "illegal
constructor". `import.meta.hot.decline()` is a no-op since Vite 5. Reload
instead:

```ts
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());
```

Define the element once, guarded:

```ts
if (!customElements.get('my-editor-container')) {
  customElements.define('my-editor-container', MyEditorContainer);
}
```

## No server rendering

The editor touches `document`, `customElements` and `canvas` at import time
of `@labre/affine/effects`. Load the editor module lazily, client-side only:

```tsx
const Editor = React.lazy(() => import('./editor'));
```

The Labre marketing site pre-renders every page and mounts the demo editor
only when the demo window opens.

## Vitest

Vitest externalizes `node_modules` and loads them with Node's resolver. The
bundles are Node-resolvable since 0.30.2, but keep the scope inlined so the
vanilla-extract transform and any future edge case go through Vite:

```ts
test: {
  server: {
    deps: {
      inline: [/@formicoidea[\\/]/];
    }
  }
}
```

## TypeScript

The bundles ship `.d.ts` compiled for ES2022 and rely on `skipLibCheck: true`
in consumers (some type references point at internal paths). Set it.

## Bundle size

A framework bundle's `.` entry (roles, rules, parsers) is data-only and safe
to import in a settings page. Import `./view` only where the editor mounts.
`./commands-manifest` is a few hundred bytes: use it to list commands and
chords in a shortcuts pane without pulling the action graph.

## Reading files on a server

A server that imports a file (a function, an MCP tool) imports the readers
from the `./interchange` subpaths, never from a package index, which loads the
editor with Lit and the drag-and-drop adapter:

```ts
import { parseSvgSketch } from '@formicoidea/labre-core/interchange';
import { BPMN_XML_IMPORT } from '@formicoidea/labre-framework-bpmn/interchange';

const { elements, report } = BPMN_XML_IMPORT.run(text, { name: 'order' });
```

`bpmn`, `c4`, `uml` and `wardley` ship one (their import capabilities, plus
the exporters that need no editor). Everything under them needs no DOM: XML
is read by the library's own `readXml`, an SVG is sanitized by an allow-list
on that tree, and no `DOCTYPE` entity is expanded. All four together are about
350 KiB minified; they load under plain Node ESM and under Deno with a
`node_modules` directory. A reader refuses a file it cannot read with an
`InterchangeImportError` whose `messageKey` is static: answer with the key,
never with `message` (it may quote the file). Bound the input before reading:
`decodeDrawio` refuses a `<diagram>` that inflates past 20 MiB, and a server
should cap the file's size itself (the editor applies `FileSizeLimitProvider`).

## Drawing toolbar items on a server

The same `./interchange` subpaths carry a framework's TOOLBOX when it has one
(ADR 0045): every toolbar item as a pure builder that returns the elements the
toolbar places, in the contract a reader's result follows (local ids, a group
after its members). C4 ships one:

```ts
import { C4_TOOLBOX } from '@formicoidea/labre-framework-c4/interchange';

const container = C4_TOOLBOX.items.find(i => i.id === 'container');
const elements = container?.build(
  { x: 0, y: 0 },
  { title: 'API', technology: 'Java' },
  'api'
);
```

A builder places one item where it is told and writes the texts it is given or
the English seed; layout and translation stay with the caller.

BPMN ships `BPMN_TOOLBOX` on `@formicoidea/labre-framework-bpmn/interchange`:
an event, a gateway or a data shape comes back as the symbol, its `bpmn:label`
and their group, an activity as one element; a flow attaches to the symbol,
`<local>:node`; a pool takes its lanes one name per line (`{ name: 'Client',
lanes: 'Sales\nOps' }`).

UML ships `UML_TOOLBOX` on `@formicoidea/labre-framework-uml/interchange`, item
ids being the node kinds (`class`, `use-case`, `lifeline`…) plus `diagram`,
`subject`, `partition`, `region`, `fragment` and `interaction-use`, link ids the
relationships (`composition`, `message-sync`…). A classifier comes back as the
shape, its compartments and their group, its members one per line
(`{ name: 'Order', attributes: '+ id : OrderId', operations: '+ pay()' }`); an
empty compartment stays empty, an absent one takes the toolbar's seed. A link
attaches to the shape, `<local>:shape`. The PlantUML, XMI and draw.io readers
write an artefact through the same assembly.

Next: [07-upgrade.md](07-upgrade.md).
