---
'@labre/data-view': minor
'@labre/affine': minor
---

Grouping on every database layout, hidden and folded groups, and "Open pages in" (ADR 0035 §8, issue B8; no new stored field).

Gallery and List now group like Table and Board, from the same stored `groupBy` and `groupProperties`: View settings → Group picks the property, each group is drawn under the table's group header (name, count, "+" adding a page into the group, a menu), and switching a layout into a gallery or a list keeps the grouping. In every layout a group can be hidden for everyone ("Hide group" in its menu, or its eye in the Group settings), which writes the existing `groupProperties[].hide`; hidden groups are listed at the end of the view, each with "Show group" (no button on a read-only view). A group can also be folded: a personal state kept in `localStorage` on this device, never in the document; a Board column folds to its header. The table's fold moves from `sessionStorage` to that store, so a fold made before this version is not restored once.

View settings gain "Open pages in" (side peek, center peek, full page) when the source's rows are documents (`rowsAreDocuments`): it writes the view's optional `openIn` on the pick, never when the pick changes nothing and never on load; absent reads side peek. New exports in `@labre/data-view`: `viewOpenIn`, `viewOpenInSet`, `rowsArePages`, `DEFAULT_OPEN_IN`; `GroupTrait` gains `visibleGroups$`, `hiddenGroups$`, `groupsCanHide`, `groupHideSet`, `collapsed$` and `collapsedSet`, and its ops two optional members, `groupHidden` and `groupHideSet`. `popViewOptions` and `popGroupSetting` take an optional wording resolver as their last argument.

New keys, English fallbacks in `@labre/data-view/translations`: `com.labre.data-view.group.hide` ("Hide group"), `.group.show` ("Show group"), `.group.hidden` ("Hidden groups"), `.group.collapse` ("Collapse group"), `.group.expand` ("Expand group"), `com.labre.data-view.open-in` ("Open pages in"), `.open-in.side` ("Side peek"), `.open-in.center` ("Center peek"), `.open-in.full` ("Full page").
