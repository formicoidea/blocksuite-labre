---
'@labre/affine': minor
'@labre/affine-block-root': minor
'@labre/affine-block-surface': minor
'@labre/affine-gfx-brush': minor
'@labre/affine-gfx-connector': minor
'@labre/affine-gfx-pointer': minor
'@labre/affine-gfx-group': minor
'@labre/affine-gfx-link': minor
'@labre/affine-gfx-template': minor
'@labre/affine-gfx-ddd-shared': minor
'@labre/affine-gfx-ddd-aggregate': minor
'@labre/affine-gfx-ddd-core-domain': minor
'@labre/affine-gfx-ddd-context-map': minor
'@labre/affine-gfx-ddd-event-storming': minor
'@labre/affine-shared': minor
'@labre/std': minor
---

feat(blocks): the DDD frameworks' automatic legends, the surface/root editor chrome, the generic gfx tools (brush, connector, pointer, group, link, template) and a handful of shared services now resolve their strings through the translation seam instead of a baked-in English literal.

Every DDD auto-legend's box title ("Legend") joins the shared `com.labre.board.legend.title` wording, and each framework's section titles (Context Map's "Boundaries"/"Relationships", Core Domain's "Sub-domains"/"Team interaction modes"/"Movement", Event Storming's "Stickies"/"Flow") get their own seed key via `AutoLegendSectionSpec.titleKey`. The Context Map relationship rows drop their pre-built `"PS — Partnership"` string in favor of `labelPrefix` + the role's own translated `labelKey`, resolved at legend-build time. The Aggregate Design Canvas template tab now carries a `TemplateCategory.nameKey` instead of a literal name.

The edgeless block toolbar (turn-into menu, alignment menu, misc actions, the "More" submenu, zoom-to-selection and mindmap Tab/Enter shortcuts), the SVG importer's eighteen best-effort remarks (one key per sentence shape, `{{name}}`/`{{unit}}`/`{{kind}}` interpolated), the brush/eraser/pen tooltips, the connector toolbar (modes, styles, add-text) and quick-tool, the pointer hand/select tooltips, the group toolbar and its "Group {{n}}" seed, the link undo button, and the templates panel's search placeholder are all translated the same way — `translateKey(std, ...WORDING)` for chrome rendered with `std` in hand, a sibling `…Wording` field for static toolbar-action configs.

Three importers (markdown, mix-text, plain-text `toDocSnapshot`) resolve their "Untitled" seed through a new shared `resolveWording(provider, wording)` helper (`@labre/affine-shared/adapters`, also now backing `ClipboardAdapter`'s size-limit toasts), since these transformers carry a `ServiceProvider` but no `std`. The doc-display-meta service's "Untitled"/"Deleted doc" fallbacks, the PNG export's untitled-doc filename, the comment toolbar button and the generic notification's "Undo" action follow the same pattern.

`@labre/std`'s "Block Version Mismatched" card resolves its four wordings through a `TranslationProvider` looked up by NAME (`createIdentifier('AffineTranslationService')`) rather than by importing `@labre/affine-shared` — the dependency between the two packages runs the other way — proven by a new unit test that registers a fake provider under the same name from an independently-constructed identifier.

With no host catalogue registered, every one of these surfaces renders exactly the English text it always has.

Left as-is, and why: `MindmapElementModel.addNode`'s "New node" default is a model default (red zone) — the Tab/Enter call sites in `blocks/root` now pass the text explicitly instead, using a seed key declared in `blocks/root`'s own table since the mindmap framework's table does not carry it yet. `bracket-pairs.ts`'s pair names and the code-block language ids are internal matching keys, never displayed. The native `showOpenFilePicker` filter descriptions (`filesys.ts`) have no reasonable seam to a host catalogue from a plain module constant. `open-doc-config.ts`'s item labels are dead code today (only `.isAllowed` is read). The `senior-tool.ts` "Pen"/"Template" names are core tools with no framework descriptor, by the same design already documented for every other core tool.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
