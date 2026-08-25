---
'@labre/affine-components': patch
---

A reusable emoji and icon picker, ready for the business frameworks to adopt

Frameworks that want to let an author brand a node — a Wardley component, an
EDGY element, a callout — each had to invent their own emoji affordance, and
the only one that existed was a bare third-party emoji panel bolted onto the
callout block.

`@labre/affine-components/icon-picker` now offers `<affine-icon-picker>`: two
tabs (Emoji and Icons), a filter box on each, recents remembered per viewer,
skin tones for emojis and nine tints for icons, and a Remove affordance. It
emits a single bubbling `select` event carrying either
`{ type: 'emoji', unicode }`, `{ type: 'affine-icon', name, color }`, or
`null` when the author asks for the icon to be taken away.

The two panels — `<affine-emoji-picker-panel>` and
`<affine-icon-picker-panel>` — are exported on their own for hosts that only
want one of them. Nothing in the editor is wired to the picker yet: it is
offered, not imposed, so no existing toolbar or menu changes behaviour.
