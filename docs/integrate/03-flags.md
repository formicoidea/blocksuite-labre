# Flags

**A flag removes tooling, never content. A missing flag means enabled.**

## What a flag is

A plain object, one optional boolean per key:

```ts
import type { LabreFlags } from '@labre/affine/flags';

const flags: LabreFlags = {
  database: false,
  mindmap: false,
  'ai-audit': false,
};
```

The keys are exported by the library. Read them from there, never keep your
own list (the Labre app's hand-kept copy went stale twice):

```ts
import { OPTIONAL_BLOCKS, OPTIONAL_CAPABILITIES } from '@labre/affine/flags';
```

`OPTIONAL_BLOCKS` today: `attachment`, `bookmark`, `callout`, `code`,
`data-view`, `database`, `divider`, `edgeless-text`, `embed`, `embed-doc`,
`frame`, `image`, `latex`, `list`, `surface-ref`, `table`, `brush`,
`mindmap`, `edgeless-media`, `template`, `link`, and the framework keys
`wardley`, `edgy`, `cynefin-estuarine`, `bpmn`, `c4`, `ddd-event-storming`,
`ddd-core-domain`, `ddd-context-map`, `ddd-templates`, `uml`.
`OPTIONAL_CAPABILITIES`: `ai-audit`.

The core bundle strips the framework keys from its copy of the list. They
come back through each framework bundle's descriptor (`flag: 'wardley'`).

## What `false` does

| Layer                                                                                 | Effect of `{ x: false }`                                             |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| creation surfaces (senior button, sub-menu, catalogue, shortcuts, templates category) | removed                                                              |
| framework elements already on a board                                                 | still rendered and editable                                          |
| block content already in a document                                                   | still stored; a gated _block_ renders nothing until the flag is back |
| schema, store extension                                                               | untouched: the document loads and round-trips identically            |

Only `getInternalViewExtensions(flags)` reads the object. The schema and
store functions accept it for source compatibility and ignore it (ADR 0009).

The reason is an incident: when a flag gated the schema, a client with the
flag off could not understand documents containing the block, and copy,
duplicate or resave dropped the content silently. Under the current contract
a flag can never damage a document.

## Read flags once, at mount

The library reads the object when it assembles the extensions. A later change
takes effect at the next mount. Wait for your flag service before building
the specs.

## Three states, not two

Your flag service answers `true`, `false`, or nothing. The library's rule is
"nothing means enabled". If your service treats "key missing from a
published payload" as "disabled" (a console kill switch), apply that rule
**only to keys you created as flags**. Applying it to every key hid
attachments and links in Labre, because those keys never existed in the flag
service.

A per-user preference layered on top must only narrow what the flag allows. A
framework the flag switched off should have no toggle at all in your
settings, otherwise a stored preference can re-enable a killed feature with
no way out.

## Incident use

`{ x: false }` stops the bleeding: no new instances, tooling gone at the next
load. It does not hide content already written. Hiding content is a code
change and a human decision.

Next: [04-host-seams.md](04-host-seams.md).
