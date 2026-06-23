---
'@labre/affine-components': patch
'@labre/affine-widget-toolbar': patch
'@labre/affine-gfx-wardley': patch
'@labre/affine-gfx-bpmn': patch
'@labre/affine-gfx-cynefin-estuarine': patch
'@labre/affine-gfx-edgy': patch
'@labre/affine-gfx-mindmap': patch
'@labre/affine-gfx-ddd-shared': patch
---

fix(edgeless): keep mobile canvas toolbars within the viewport

On narrow (mobile) viewports two canvas toolbars overflowed off-screen,
hiding actions:

- The selected-element contextual toolbar grew to `max-content` with no
  upper bound. It is now capped to the available viewport width (floating-ui
  `size` middleware) and wraps to a second row instead of overflowing. (A
  scroll container was avoided on purpose: the "More" dropdown is a descendant
  of the toolbar, so `overflow` would clip it and make it unclickable.)
- The senior framework slide-menu was sized to `max-width: calc(100vw - 16px)`
  but right-aligned to a center-ish toolbar button, so a near-full-width menu
  hung off the LEFT edge on mobile. It is now centered on the main toolbar and
  capped to 95% of the toolbar's width (the existing slide-menu scroll handles
  any remaining overflow), via a shared `clampSeniorMenuToToolbar` helper that
  replaces the duplicated inline positioning in all six framework senior
  buttons (Wardley, BPMN, Cynefin, EDGY, Mind Map, DDD). Desktop is unaffected
  since those menus are narrower than the cap.
