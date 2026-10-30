---
'@labre/affine': patch
---

"+ view" follows the host's list of sources while it is open: a host that fills its `DataSourcePickerService.list()` after the first call (labre does) now sees its sources appear in the open menu, as the view settings' "Source" list already did, instead of only from the second opening. The list or presets shape is still decided at the opening.
