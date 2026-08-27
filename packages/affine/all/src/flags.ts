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
  // Media / template / link tools, promoted out of the former "Others"
  // senior submenu (each individually toggleable). The edgeless-text tool is
  // gated by the 'edgeless-text' block flag above.
  'edgeless-media',
  'template',
  'link',
  'wardley',
  'edgy',
  'cynefin-estuarine',
  'bpmn',
  'c4',
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

/**
 * Editor CAPABILITIES — a second switch axis, deliberately not a member of
 * {@link OPTIONAL_BLOCKS}.
 *
 * ## Why a separate list (PF14.1 decision)
 *
 * `OPTIONAL_BLOCKS` answers one question: "does this BLOCK or FRAMEWORK exist
 * for this user". Every entry names a thing a document can contain, which is
 * what makes the contract above meaningful — "the schema is registered
 * unconditionally, so the content is safe" is a sentence about content.
 *
 * `ai-audit` names no block, no element and no schema. It is a capability of
 * the editor: whether this build can ask an assistant for an opinion. Filing it
 * under `OPTIONAL_BLOCKS` would have cost nothing at the keyboard and a lot
 * afterwards — `FrameworkId` is asserted `satisfies readonly OptionalBlock[]`,
 * `scripts/build-bundles.mjs` reads the list as the set of things a bundle can
 * carry, and the flags README would have had to explain why one of its entries
 * has no schema to protect. A list whose members do not answer the same
 * question is a list that has to be filtered at every use.
 *
 * ## Same contract, in full
 *
 * Everything the flag contract promises holds here, and holds trivially:
 * missing key = enabled; switching it off removes TOOLING only; and there is no
 * data to lose, because the audit seam persists nothing at all — criteria are
 * code, findings are session state in `ValidationManager.auditFindings$`, and
 * neither ever reaches a `Y.Doc`. Off, the command is not registered: it
 * disappears from the registry, both manifests and the keymap together. Back
 * on, it is there again, with the document untouched in between.
 *
 * Hosts pass ONE object ({@link LabreFlags}): the two key spaces are disjoint,
 * so nothing about the wiring changes.
 */
export const OPTIONAL_CAPABILITIES = [
  /**
   * The AI audit seam (PF14.1): the `map.audit` command on the `'agent'`
   * surface. Independent of whether an `AuditProvider` is actually registered —
   * this says whether the editor OFFERS the capability, the provider says
   * whether anything can answer. Both are needed for an audit to run, and the
   * degraded paths differ: switched off, the command does not exist; wired off,
   * it exists and refuses cleanly.
   */
  'ai-audit',
] as const;

export type OptionalCapability = (typeof OPTIONAL_CAPABILITIES)[number];

/** Map of capability -> enabled. Missing keys default to enabled. */
export type CapabilityFlags = Partial<Record<OptionalCapability, boolean>>;

/**
 * The one object a host passes. Two disjoint key spaces, one bag — a host that
 * only ever spoke `BlockFlags` keeps compiling and keeps behaving identically.
 */
export type LabreFlags = BlockFlags & CapabilityFlags;

/** Whether `capability` is enabled. Same defaulting rule as a block flag. */
export function isCapabilityEnabled(
  flags: CapabilityFlags | undefined,
  capability: OptionalCapability
): boolean {
  return flags?.[capability] !== false;
}
