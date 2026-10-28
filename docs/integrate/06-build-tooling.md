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

Wardley reads and writes two languages there: OWM (`WARDLEY_OWM_IMPORT`; its
export needs the editor) and the JSON of `@formicoidea/wardley-map-renderer`,
both ways with no editor (`WARDLEY_JSON_IMPORT`, `WARDLEY_JSON_EXPORT`, ids
`wardley:json:import` / `wardley:json:export`). The JSON reader draws with
the toolbox builders below, an evolution being a change arrow to a point,
and refuses a bad document with a report, never an exception; the writer
takes the board's elements, live models or stored props.

## Drawing toolbar items on a server

The same `./interchange` subpaths carry a framework's TOOLBOX when it has one
(ADR 0045): every toolbar item as a pure builder that returns the elements the
toolbar places, in the contract a reader's result follows (local ids, a group
after its members). C4, EDGY (`EDGY_TOOLBOX` holds every item but the "EDGY
dynamic" template, which inserts a snapshot) and Cynefin/estuarine
(`@formicoidea/labre-framework-cynefin/interchange`, `CYNEFIN_ESTUARINE_TOOLBOX`)
ship one. C4's:

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

Wardley ships `WARDLEY_TOOLBOX` on `@formicoidea/labre-framework-wardley/interchange`:
one component added to an existing map is `component.build(at, { name })`, a
node, its `wardley:label` name and their group; the market, the pipeline and
Porter's forces come with their own wiring. The polygon area is a drawing tool
and is not in it; a rectangular area comes out on top, and sending it under
the components it covers is the caller's (the editor does it on placement).

UML ships `UML_TOOLBOX` on `@formicoidea/labre-framework-uml/interchange`, item
ids being the node kinds (`class`, `use-case`, `lifeline`…) plus `diagram`,
`subject`, `partition`, `region`, `fragment` and `interaction-use`, link ids the
relationships (`composition`, `message-sync`…). A classifier comes back as the
shape, its compartments and their group, its members one per line
(`{ name: 'Order', attributes: '+ id : OrderId', operations: '+ pay()' }`); an
empty compartment stays empty, an absent one takes the toolbar's seed. A link
attaches to the shape, `<local>:shape`. The PlantUML, XMI and draw.io readers
write an artefact through the same assembly.

The Context Map ships one too, `CONTEXT_MAP_TOOLBOX` on
`@formicoidea/labre-framework-ddd-context-map/interchange`; its artefacts are
built by `@formicoidea/labre-ddd-shared/headless`, the editor-free entry of the
DDD boards' shared bundle, which a server installs beside the framework.

Event Storming ships `EVENT_STORMING_TOOLBOX` on
`@formicoidea/labre-framework-ddd-event-storming/interchange`, built the same
way: item ids being the sticky kinds (`domain-event`, `command`, `aggregate`…,
`external-system`, `hotspot`) plus `board`, the one link id `flow`. A sticky
comes back as its shadow, its face carrying the role and the words
(`{ name: 'Order placed' }`, or the toolbar's seed) and their group; a flow
attaches to the face, `<local>:face`.

The Core Domain Chart ships `CORE_DOMAIN_TOOLBOX` on
`@formicoidea/labre-framework-ddd-core-domain/interchange`, from the same
shared builders: item ids `chart`, the five sub-domain dots (`big-bet`,
`platform`, `outsourced`, `bc-current`, `bc-future`) and the three Team
Topologies markers (`collaboration`, `xaas`, `facilitating`), each dot and
marker captioned by its `name` slot; link id `movement`.

Next: [07-upgrade.md](07-upgrade.md).
