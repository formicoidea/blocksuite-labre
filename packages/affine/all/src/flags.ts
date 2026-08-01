/**
 * Feature flags for editor TOOLING.
 *
 * ## Contract (reversed in PF4 — see `docs/adr/0009`)
 *
 * A flag NEVER decides whether a document can be read. Block schemas
 * (`getAffineSchemas`) and store extensions (`getInternalStoreExtensions`) are
 * registered unconditionally, so **every document opens, round-trips and saves
 * identically whatever the flags say**. Turning a flag off never deletes,
 * strips or downgrades stored content, and never fails schema validation on
 * load; turning it back on restores the tooling with the content untouched.
 *
 * What a flag gates is the **tooling** that lets a user CREATE and reach that
 * content:
 * - the senior toolbar button (edgeless) and its submenus,
 * - the keyboard shortcuts it owns (see `getShortcutManifest`, which filters on
 *   {@link ShortcutDescriptor.owner}),
 * - future side-panel / command-palette entries and validation rules.
 *
 * Business framework modules (wardley, edgy, bpmn, cynefin-estuarine, brush,
 * mindmap, ddd-*) therefore ship their view layer as TWO extensions: an
 * always-registered `…RenderViewExtension` (element view, renderer,
 * interaction, contextual toolbar of an already-placed element) and a
 * flag-gated `…ViewExtension` (senior button + creation shortcuts). Elements
 * already drawn on a canvas keep painting, stay selectable and stay editable
 * when their framework is switched off — only the way to add new ones goes
 * away. The consequence is accepted: the bundle always carries every
 * framework's renderer, so a framework can no longer ship fully "dark".
 *
 * Flags default to enabled: `{ mindmap: false }` hides the Mind Map tooling, an
 * empty object (or no flags at all) enables everything.
 *
 * Note for hosts consuming the PUBLISHED bundles: `scripts/build-bundles.mjs`
 * strips the four business-framework flags (`wardley`, `edgy`, `bpmn`,
 * `cynefin-estuarine`) from `@formicoidea/labre-core`'s copy of this file —
 * they exist only when the matching `@formicoidea/labre-framework-*` bundle is
 * installed, and the host applies them through that bundle's descriptor. The
 * examples here therefore use a flag that always ships with core.
 *
 * Caveats:
 * - The reversal covers **surface elements** (everything living in the surface
 *   `elements` map: brush, mindmap, wardley, edgy, cynefin, estuarine, bpmn,
 *   coreDomain). BLOCKS (database, code, image, latex, frame, edgeless-text, …)
 *   still have their whole view extension gated, because their renderer and
 *   their tooling live in the same extension. Their data is safe — schema and
 *   store side are unconditional, so the document loads, round-trips and
 *   re-renders untouched once the flag is back on — but a disabled block
 *   currently renders as nothing until its view extension is split the way the
 *   frameworks' were. See the "Consequences" section of `docs/adr/0009`.
 * - `latex` covers both the latex block and inline latex.
 * - `frame` also covers the frame panel fragment.
 * - `ddd-templates` covers all four DDD Templates-panel categories, so the
 *   catalogue survives disabling individual DDD senior buttons.
 */
export const OPTIONAL_BLOCKS = [
  'attachment',
  'bookmark',
  'callout',
  'code',
  'data-view',
  'database',
  'divider',
  'edgeless-text',
  'embed',
  'embed-doc',
  'frame',
  'image',
  'latex',
  'list',
  'surface-ref',
  'table',
  // gfx modules
  'brush',
  'mindmap',
  // Standalone text / add-file tools, promoted out of the former "Others"
  // senior submenu (each individually toggleable).
  'edgeless-media',
  'template',
  'link',
  'wardley',
  'edgy',
  'cynefin-estuarine',
  'bpmn',
  'ddd-event-storming',
  'ddd-core-domain',
  'ddd-context-map',
  'ddd-templates',
] as const;

export type OptionalBlock = (typeof OPTIONAL_BLOCKS)[number];

/** Map of optional block -> tooling enabled. Missing keys default to enabled. */
export type BlockFlags = Partial<Record<OptionalBlock, boolean>>;

/**
 * Whether the tooling of `block` is enabled. Never consult this to decide
 * whether content can be read or rendered — see the contract above.
 */
export function isBlockEnabled(
  flags: BlockFlags | undefined,
  block: OptionalBlock
): boolean {
  return flags?.[block] !== false;
}
