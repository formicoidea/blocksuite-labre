---
'@labre/affine-widget-edgeless-toolbar': patch
'@labre/affine-shared': patch
'@labre/affine-model': patch
---

The canvas font-family picker now offers the families the host configured
through `FontConfigExtension`, not every family the library knows: a host that
drops a family from its font list drops it from the picker too. A text stored
in a family the host no longer ships keeps it — it paints with the fallback and
the picker shows its name greyed and marked unavailable
(`com.labre.edgeless-toolbar.font-family-unavailable`, "{{name}} (unavailable)")
— and nothing in the document is rewritten. With no font list registered, the
picker lists every family, as before.

Plus Jakarta Sans (SIL OFL 1.1) replaces Satoshi in the default font lists:
light, regular, semibold and bold, upright and italic, from the public
`fonts.cdnfonts.com` mirror in `CommunityCanvasTextFonts`. Satoshi leaves both
`CommunityCanvasTextFonts` and `AffineCanvasTextFonts`, whose licence forbids
offering it as a selectable font in a SaaS or design tool; the
`FontFamily.Satoshi` value stays valid, so documents that use it still load and
render.
