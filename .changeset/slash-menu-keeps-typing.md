---
'@labre/affine-widget-slash-menu': patch
---

fix(blocks): a slash menu that found nothing survives the next letter

Typing `/eeee`, deleting back to `/` and typing `h` used to close the slash
menu instead of showing the headings. The menu closes on the first key that
follows an empty result, and the query state behind that verdict is refreshed
asynchronously — so the `h` was judged against a `no_result` that the deletion
had already made obsolete.

A key that adds a character to the query now keeps the menu open and refreshes
it. Everything else closes it exactly as before: space, `Escape`, `Enter`, the
arrows, and any character pressed with a modifier.
