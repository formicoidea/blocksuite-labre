/**
 * This package's own wordings, joined into `PACKAGE_WORDINGS` in
 * `@labre/affine/translations` — see that file and
 * `packages/affine/shared/src/services/translation-service/README.md`.
 *
 * A plain local tuple type, not `ChromeWording`
 * (`@labre/affine-shared/services`): `@labre/std` must never import
 * `@labre/affine-shared` (the dependency runs the other way — see
 * `view/element/block-component.ts`'s own doc comment), so this package
 * cannot reuse that type any more than it can reuse `translateKey` itself.
 */
type Wording = readonly [key: string, fallback: string];

/**
 * `BlockComponent.renderVersionMismatch`'s four wordings
 * (`view/element/block-component.ts`) — the "Block Version Mismatched" card
 * shown when a document carries a block flavour newer or older than this
 * editor knows how to render.
 */
export const STD_VERSION_MISMATCH_TITLE: Wording = [
  'com.labre.std.version-mismatch.title',
  'Block Version Mismatched',
];

export const STD_VERSION_MISMATCH_BODY: Wording = [
  'com.labre.std.version-mismatch.body',
  'We can not render this {{flavour}} block because the version is mismatched.',
];

export const STD_VERSION_MISMATCH_EDITOR_VERSION: Wording = [
  'com.labre.std.version-mismatch.editor-version',
  'Editor version: {{version}}',
];

export const STD_VERSION_MISMATCH_DATA_VERSION: Wording = [
  'com.labre.std.version-mismatch.data-version',
  'Data version: {{version}}',
];

export const STD_WORDINGS: readonly Wording[] = [
  STD_VERSION_MISMATCH_TITLE,
  STD_VERSION_MISMATCH_BODY,
  STD_VERSION_MISMATCH_EDITOR_VERSION,
  STD_VERSION_MISMATCH_DATA_VERSION,
];
