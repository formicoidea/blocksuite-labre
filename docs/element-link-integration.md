# Element link — host integration contract

Edgeless drawing elements (shape / text / connector / group) can carry a link to
an existing doc **or** an external URL. On hover, a small arrow
(`edgeless-element-link` widget) opens the target. This is the minimal
counterpart to "Create linked doc" — no embed card, just a reference stored on
the element.

The library ships the **UI and the data fields**; it depends on the host
(labreapp) for the **doc picker** and **where the doc opens**. Both are existing
provider contracts already used by other features, so wiring is typically
**zero extra code** in the host.

## What the library provides

- **Storage** — two optional fields on `GfxPrimitiveElementModel`
  (`@labre/std/gfx`): `externalLink?: string` and `linkedDocId?: string`. At most
  one is set. Backward-compatible (old documents read `undefined`, no migration).
- **Menu** — `Link` / `Edit link` / `Remove link` in the edgeless element
  context menu (`packages/affine/blocks/root/.../toolbar/more.ts`).
- **Hover arrow** — `edgeless-element-link` widget, registered with the
  `edgeless-selected-rect` view extension.

## What the host must register

| Capability            | Provider (lib identifier)                                                                 | Already used by                  |
| --------------------- | ----------------------------------------------------------------------------------------- | -------------------------------- |
| Pick a doc or URL     | `QuickSearchProvider` (`@labre/affine-shared/services`)                                   | bookmark "add link", embed doc   |
| Open the linked doc   | `RefNodeSlotsProvider` (`@labre/affine-inline-reference`) — subscribe to `docLinkClicked` | `@`-references, embed linked doc |
| (optional) side panel | `SidebarExtensionIdentifier` (`@labre/affine-shared/services`)                            | existing doc side-view           |

Behaviour when absent:

- No `QuickSearchProvider` → `Link` / `Edit link` are **hidden** (they would
  no-op). `Remove link` stays available. Nothing breaks.
- No `RefNodeSlotsProvider` → clicking the arrow on a doc link does nothing; URL
  links still open via `window.open`.

## Data flow

1. **Set** — menu item calls `QuickSearchProvider.openQuickSearch()`. Result:
   - `{ docId, params? }` → store `{ linkedDocId: docId }`
   - `{ externalUrl }` → store `{ externalLink: url }`
2. **Open** (hover arrow click / Enter / Space):
   - `linkedDocId` → `RefNodeSlotsProvider.docLinkClicked.next({ pageId, host })`
     — the host routes this to wherever it opens doc references.
   - `externalLink` → `window.open(url, '_blank')`.

## Host verification checklist

- [ ] `QuickSearchProvider` registered → `Link` appears on a selected shape and
      its modal returns a doc id or URL.
- [ ] The `docLinkClicked` handler opens the linked doc **in the document
      side-view** for this case (not only the active view), matching the desired
      UX. Our event carries `{ pageId, params?, host }` — same shape as every
      other doc link, so the existing handler should cover it unchanged.
- [ ] External-URL links open in a new tab.

> Note: the standalone playground does **not** register `QuickSearchProvider`,
> so the menu items are hidden there by design. Test the full pick→open flow in
> labreapp (or register a stub `QuickSearchExtension` in a dev harness).
