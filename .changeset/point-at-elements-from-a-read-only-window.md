---
'@labre/std': minor
'@labre/affine-block-surface': minor
---

feat(std): a transient per-element highlight api for embedded read-only windows

Host apps embedding a map preview (an AI conversation thread, a report, a
sidebar) could only point at elements by reframing the viewport on the union of
their bounds. That reads as "somewhere around here" and cannot distinguish two
operations whose elements already share the same view.

The gfx controller now carries a first-class emphasis API:

```ts
gfx.highlightElements(ids: string[], opts?: {
  reframe?: boolean;   // unite the target bounds and reframe first (default false)
  duration?: number;   // ms before auto-clear, default 2000, 0 = until cleared
  padding?: [number, number, number, number]; // reframe padding
  smooth?: boolean;    // animate the reframe, default true
}): void

gfx.highlight.clear();          // drop the emphasis early
gfx.highlight.highlighted$;     // signal of the currently emphasized ids
```

Guarantees:

- **Non-destructive** — no store write, no persisted selection, no edit mode.
  It is safe on a read-only or non-interactive editor.
- **Per element** — an accent ring is stroked around each target, following the
  element rotation; connectors and frames use their bound box. Unknown ids and
  non-graphic blocks are ignored, and elements deleted while highlighted simply
  drop out.
- **Composable** — `reframe: true` unites the target bounds and calls the
  existing viewport reframe before emphasizing.
- **Transient** — the highlight auto-clears after `duration`; calling it again
  replaces the previous set and restarts the timer.

State lives in `ElementHighlightManager` (`@labre/std`, registered by default on
every std scope); the ring is drawn by `ElementHighlightOverlay`
(`@labre/affine-block-surface`), registered for the `edgeless`,
`preview-edgeless` and `mobile-edgeless` view scopes.
