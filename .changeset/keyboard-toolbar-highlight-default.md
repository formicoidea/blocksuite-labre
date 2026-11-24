---
'@labre/affine-widget-keyboard-toolbar': patch
---

The "Default Color" entries of the mobile keyboard toolbar's Highlight panel
now remove the highlight (#737, port of upstream toeverything/AFFiNE 2198970).
They had no action, so tapping them did nothing and a text colour or
background could not be cleared on mobile. The Color entry clears the text
colour, the Background entry clears the background, with the same payload as
the desktop highlight menu; the coloured entries are unchanged.
