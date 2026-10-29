---
'@labre/affine': patch
---

A property's menu opened from a view's « Properties » list sits beside the list, on the side with more room, and stays inside the viewport: below the row it covered the list, and in a host's narrow sidebar (about 470px) it hid the rows it edits while its « Type » sub-menu hung half off screen. A sub-menu now opens on the side its menu was placed on and shifts back into the viewport. `popPropertyMenu` takes an optional fourth argument `{ beside: true }`.
