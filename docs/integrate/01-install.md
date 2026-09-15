# Install

**Install the core bundle, then one bundle per framework you want. Keep one
copy of each in your build.**

## Packages

The library is published as generated bundles under the `@formicoidea` scope.
The source packages (`@labre/*`) are private and never on npm.

| Package                                                                                   | Gives you                                                                                                           |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `@formicoidea/labre-core`                                                                 | the whole editor: text blocks, whiteboard, base shapes, mindmap, database…                                          |
| `@formicoidea/labre-framework-wardley`                                                    | Wardley maps                                                                                                        |
| `@formicoidea/labre-framework-edgy`                                                       | EDGY                                                                                                                |
| `@formicoidea/labre-framework-bpmn`                                                       | BPMN                                                                                                                |
| `@formicoidea/labre-framework-c4`                                                         | C4                                                                                                                  |
| `@formicoidea/labre-framework-cynefin`                                                    | Cynefin / Estuarine                                                                                                 |
| `@formicoidea/labre-framework-ddd-event-storming`, `-ddd-core-domain`, `-ddd-context-map` | the three DDD tools                                                                                                 |
| `@formicoidea/labre-ddd-shared`                                                           | pulled in by the DDD frameworks                                                                                     |
| `@formicoidea/labre-framework-ddd-aggregate`                                              | DDD template categories (no senior button)                                                                          |
| `@formicoidea/labre-framework-uml`                                                        | UML, nine diagram kinds: class, package, object, use case, component, deployment, activity, state machine, sequence |

Every framework bundle depends on the **exact** core version it was built
with. Install them together and bump them together.

```bash
pnpm add @formicoidea/labre-core @formicoidea/labre-framework-wardley
```

## Aliases (recommended)

The Labre application aliases the bundles back to the `@labre/*` names so its
source reads like the library's:

```json
{
  "dependencies": {
    "@labre/affine": "npm:@formicoidea/labre-core@^0.39.0",
    "@labre/framework-wardley": "npm:@formicoidea/labre-framework-wardley@^0.39.0"
  }
}
```

Then `import { … } from '@labre/affine/std'`. Subpaths are the same as in the
repo: `/std`, `/store`, `/shared/services`, `/extensions/view`, `/flags`,
`/frameworks`, `/blocks/<name>`, `/gfx/<name>`…

## Peer surface you own

The bundles declare these as normal dependencies, but your app will import
some of them directly, so pin them once at the app level to avoid duplicates:

- `lit` (3.x), `yjs` (13.6.x), `y-protocols`
- `@preact/signals-core` (1.14.4 or later; the library relies on its
  `batch()` semantics)
- `@toeverything/theme` (the CSS variables every component reads)
- `katex` (if you render formulas), `rxjs`

## One copy, or nothing works

The editor registers services in a container at startup. If your bundle
contains two copies of the core (an alias plus an exact pin resolved to a
second folder, or npm hoisting gone wrong), the second copy re-registers every
service and throws `Service … already exists` at runtime. The build stays
green.

- Use pnpm, or run `npm dedupe`.
- Keep every `@formicoidea/*` range at the same version.
- Add a build check. The Labre marketing site greps its output chunk for the
  string that marks the core entry and fails when it appears twice
  (`apps/marketing/scripts/assert-single-lib.mjs` in the `labre` repo).

## Styles

Import once, before mounting:

```ts
import '@labre/affine/effects'; // registers every custom element
import '@toeverything/theme/style.css'; // the --affine-* variables
import 'katex/dist/katex.min.css'; // only if you use formulas
```

The library ships vanilla-extract `.css.ts` files. Your bundler needs the
plugin; see [06-build-tooling.md](06-build-tooling.md).

Next: [02-mount.md](02-mount.md).
