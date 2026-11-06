---
'@labre/affine-components': minor
---

`edgeless-color-picker` mounts outside an editor. `std` is now optional (read
from the Lit context when an editor provides it, undefined and never touched
otherwise), and three optional properties serve a host that embeds the picker
on its own: `labels` carries the host's words for the `Colors` / `Custom` tabs
and the `Normal` / `Light` / `Dark` modes (the editor's English wording fills
any gap), `hideAlpha` drops the alpha slider and the `%` field and makes
`pick` report a 6-digit hex, `hideTabs` drops the tab bar so only the
single-colour custom picker shows. `hex6$` reads the current colour as
`#rrggbb` either way. The palette canvas no longer throws where there is no 2d
context (jsdom, happy-dom). Toolbars that leave the options off see no change.
