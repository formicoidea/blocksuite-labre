---
'@labre/affine-block-root': minor
'@labre/affine-widget-edgeless-selected-rect': minor
---

Round out the canvas element link feature (edit / remove / groups / a11y).

- The context menu is now link-state aware: an unlinked element shows **Link**,
  a linked one shows **Edit link** (re-pick a doc or URL) and **Remove link**
  (clears the stored target). External-URL links now emit a `Link` telemetry
  event, matching the existing `LinkedDocCreated` for doc links.
- The hover arrow now resolves to the nearest **linked group**: hovering a child
  of a group that carries a link shows the arrow on the group's bounds (a child
  with its own link still wins).
- The hover arrow is keyboard accessible: `role="button"`, focusable, with an
  `aria-label`/`title` and Enter/Space activation.
