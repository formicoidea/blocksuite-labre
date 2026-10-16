---
'@labre/affine-widget-linked-doc': minor
---

The default `@` menu now only references pages that already exist: it no longer offers "New Doc" or "Import". Creating a page stays on the slash menu's "New Page". A host that wants the creation group back can add `LinkedWidgetUtils.createNewDocMenuGroup` to its own `getMenus`.

When nothing matches (or a host's `getMenus` returns only empty groups), the desktop popover now says "No page found" (`com.labre.linked-doc.no-result`) instead of opening as an empty box.
