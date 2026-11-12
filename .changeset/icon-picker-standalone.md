---
'@labre/affine-components': minor
'@labre/affine': minor
---

The icon picker is public: `@labre/affine/components/icon-picker` (in
`@formicoidea/labre-core`) exports `openIconPicker(anchor, options)`, which opens
`affine-icon-picker` anchored to an element outside any editor and resolves
with the choice as plain JSON (`{ type: 'emoji', unicode }` or
`{ type: 'affine-icon', name, color }`), `null` for "Remove", or `undefined`
when the user cancels (Escape, a click outside, the host's `signal`). Call the
entry's `effects()` once at boot to register the elements; it no longer throws
when called twice. Pass `translation` (the service you give
`TranslationExtension`) to translate the picker without an editor, English
otherwise; the element itself takes the same `translation` property. Redraw a
stored icon with `renderAffineIcon(name)` painted in `color`, an emoji as text.
