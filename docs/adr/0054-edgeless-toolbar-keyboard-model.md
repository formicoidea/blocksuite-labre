# ADR 0054 — The edgeless toolbar is a real toolbar for the keyboard

- Status: **accepted** (2026-11-19)
- Deciders: lead decision on issue #679 (design audit P1-7 of 2026-11-18)
- Related ADRs: [0009](0009-reversed-flag-contract.md) (a flag removes a
  button, so the keyboard walks what is drawn),
  [0051](0051-read-only-viewer-is-the-editor.md) (the read-only viewer draws
  no toolbar).

## Context

The canvas (edgeless) toolbar could not be used without a mouse. Its buttons
had no accessible name, and none could take focus but the senior pager's
arrows (WCAG 2.1.1, 2.4.7, 4.1.2). The keyboard had one way in, the Alt+←/→
highlight (`walkHighlight`, `edgeless-keyboard.ts`): a ring drawn on a
toolbar item while the DOM focus stays on the canvas. Its docblock explained
why it was not focus: "focus in the toolbar's shadow tree would take the
keystrokes away from the canvas dispatcher". That is true, and it is what a
user who chose the toolbar wants; it is only wrong while they are on the
canvas. Nothing exposed the highlighted button to assistive technology, and
Tab could not reach the toolbar at all: the canvas's Tab binding called
`preventDefault()` before asking whether it had anything to do, and behind it
the root's `fallbackKeymap` swallows every Tab whose target is not a native
control — the editor host never is one.

## Decision

The toolbar takes real DOM focus, on the APG toolbar pattern.

1. **One `role="toolbar"`** on `.edgeless-toolbar-container`, named
   `com.labre.edgeless-toolbar.name` ("Canvas tools").
2. **The focus target is the button host** — `edgeless-tool-icon-button` (and
   its subclass `edgeless-toolbar-button`), the node that already carries
   `role="button"`. Its name (`aria-label`, from `label` or a plain-text
   tooltip), its state (`aria-pressed`, on the row only), its roving
   `tabindex` and the `:focus-visible` that draws the ring are all on that
   host; the ring itself is painted on its inner box, the same 2px opaque
   outline as `[data-keyboard-highlight]`. "More tools" is an `icon-button`,
   focused the same way.
3. **Roving `tabindex`, one Tab stop.** The stop is the button the keyboard
   last stood on while it is in the toolbar, otherwise the active tool's
   button (`aria-pressed="true"`), otherwise the first. Every other button,
   the pager arrows included, is `tabindex="-1"`.
4. **Keys on a focused button** (`:focus-visible` only — a button focused by a
   pointer click hands every key to the canvas, as before):
   - ←/→ walk the buttons, the pen and the eraser one by one, and page the
     senior row when the next tool is paged out (`stepToolbarHighlight`, the
     same walk as the highlight); Home/End go to the first and the last;
   - Enter and Space press the button. A press that changes the tool hands
     focus back to the canvas; a press that opens a framework's sub-menu
     keeps focus on its button; anything else (undo, the layers pane) keeps
     it where it is. With a sub-menu open and a command highlighted, Enter
     runs that command, as on the canvas;
   - Escape closes the open sub-menu and keeps focus on its button; with none
     open it gives focus back to the canvas and leaves the tool as it is;
   - Alt+←/→ walk the open sub-menu, as on the canvas (the dispatcher keeps
     them); with none open they walk the toolbar like the plain arrows;
   - Tab and Shift+Tab leave the toolbar the browser's way. ↑/↓ do nothing.
     These keys stop at the toolbar: the canvas dispatcher listens on
     `document` and would otherwise move the selection, switch to the pan tool
     on Space, or reset the tool on Escape. Every other key still reaches the
     canvas, as its shortcuts do while the canvas has focus.
5. **The canvas lets Tab go** when nothing is being edited and no single mind
   map node is selected (the two cases its Tab binding acts on), so Tab from
   the canvas reaches the toolbar. It says so by returning `true`: the
   dispatcher stops there and the root's `fallbackKeymap` never sees the key.
   Page mode is untouched.
6. **The pager arrows are not Tab or arrow stops.** The arrows page the row as
   they walk, so every senior tool is reachable without them; they keep their
   names ("Previous tools", "Next tools") for a screen reader's browse mode
   and stay clickable.
7. **The Alt+←/→ highlight stays** as a shortcut from the canvas, unchanged;
   focus entering the toolbar clears it, so the two rings never show at once.

## Consequences

- The keyboard path is held by the integration suite
  (`edgeless/edgeless-toolbar-keyboard.spec.ts`, real Playwright keys), the
  names and the state by `edgeless-toolbar-a11y.spec.ts`, the senior tools'
  declared labels by `affine/all`'s `toolbar-names.unit.spec.ts`, the
  highlight by `canvas-arrows-move-first.spec.ts`.
- A tool registered tomorrow is in the walk with nothing to do: the row is
  read from what is drawn, item by item, and a flag that removes a button
  removes it from the walk (ADR 0009).
- A tool whose tooltip is a template, or is emptied while its menu is open,
  must pass `label` to its button, or it is unnamed — which the integration
  spec reports.
- A canvas shortcut that is not one of the toolbar's keys (Delete, a tool
  letter, typing into a selected mind map node) still acts while focus is in
  the toolbar, exactly as it does from the canvas.
- On a read-only document the toolbar draws nothing, so there is nothing to
  reach (ADR 0051).
