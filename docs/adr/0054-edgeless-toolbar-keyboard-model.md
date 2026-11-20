# ADR 0054 — The edgeless toolbar is a real toolbar for the keyboard

- Status: **accepted** (2026-11-20)
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
   stands on while it is in the toolbar, otherwise the active tool's button
   (`aria-pressed="true"`, kept current by the buttons' `toolbar-row-state`
   event), otherwise the first. Every other button, the pager arrows and "More
   tools" included, is `tabindex="-1"`, written as an attribute.
4. **Keyboard mode is a row button holding the focus, which only the keyboard
   gives it** (product owner, 2026-11-20: navigating the toolbar never
   overrides the canvas's keyboard). A pointer press on a row button or a
   pager arrow has its `mousedown` default prevented and leaves the focus on
   the editor host, where a press in the toolbar left it before #679, when no
   button could take focus: after a click every key is the canvas's and no
   ring shows. In keyboard mode the row takes its own keys only, and stops
   them, since the canvas dispatcher listens on `document` and would also
   move the selection, pan on Space or reset the tool on Escape:
   - ←/→ walk the buttons, the pen and the eraser one by one, and page the
     senior row when the next tool is paged out (`stepToolbarHighlight`, the
     same walk as the highlight); Home/End go to the first and the last.
     With a sub-menu open, Alt+←/→ walk it, as on the canvas;
   - Enter and Space press the button once (a held key's repeats do
     nothing), the way a pointer does: pointer down, mouse down, up, click,
     at what is drawn at the button's centre — the shape and mind map
     buttons press on a `mousedown` their draggable turns into a click, which
     a lone `click` never reaches. The Alt+←/→ highlight's Enter goes through
     the same press;
   - Escape closes what the button opened and gives it the focus back; with
     nothing open it gives the canvas the keyboard, the tool unchanged;
   - Tab leaves the row forwards, the browser's way (one stop); Shift+Tab goes
     back to the canvas.
     Every other key — Delete, Backspace, a tool letter, Ctrl or Meta shortcuts
     — goes on to the canvas, as from the canvas itself.
5. **What a press does with the focus.** A press that opens something from
   the button — any popper the toolbar tracks (a framework's sub-menu, a
   tool's options: frame, connector, pen, note, shape, mind map) or a panel
   the button appends beside itself (templates) — keeps the focus on the
   button: Escape closes it and returns the focus, and Tab moves on to its
   controls that the browser can focus. A press that only picks a tool (the
   eraser) gives the canvas the keyboard back. Anything else (undo, the layers
   pane, a text, add a file) leaves the focus on the button. A press that
   changes the selection makes `RangeBinding` (`framework/std`) focus the
   editor host whenever the selection holds no text, sometimes a hundred
   milliseconds later; after a keyboard press or Escape, and until the next
   key or pointer press, the toolbar sends a focus that lands on the host
   back to the button, rather than changing `std`.
6. **The canvas gives the toolbar the focus.** From the editor host, with no
   text being edited and no single mind map node selected, Tab moves the
   focus to the row's stop itself: the notes come before the toolbar in the
   DOM and are `contenteditable`, so the browser's next stop would be the
   first note's text. Shift+Tab from the canvas leaves the editor backwards,
   the browser's way (the root's `fallbackKeymap` used to swallow it). In a
   text being edited, on a mind map node, in a pane's field, in presentation
   or on a readonly board, Tab and Shift+Tab stay what they were.
7. **The focus is never left on the page's body.** While the keyboard came
   from the row (until it is back on the canvas, leaves the editor, or a
   pointer presses), a focus that drops to the body — a pane or a menu closing
   on its own Escape, a text editor leaving, the row re-dealt under a resize —
   is given back to the row button the keyboard stood on, to the row's stop
   if that button is gone, to the canvas if the row is. A frame-by-frame
   watch does it, only in that state, since a focused element that is removed
   fires no event. A page that lost the focus to the browser is left alone.
8. **The pager arrows are not Tab or arrow stops.** The arrows page the row as
   they walk, so every senior tool is reachable without them; they keep their
   names ("Previous tools", "Next tools") and stay clickable.
9. **The Alt+←/→ highlight stays** as a shortcut from the canvas, unchanged;
   focus entering the toolbar clears it, so the two rings never show at once.

## Consequences

- The keyboard path is held by the integration suite
  (`edgeless/edgeless-toolbar-keyboard.spec.ts`, real Playwright keys and
  mouse): every button pressed by a click, Enter, Space and a held Enter must
  do the same thing; every button that opens something must keep the focus,
  close on Escape and give it back. The names and the state are held by
  `edgeless-toolbar-a11y.spec.ts`, the senior tools' declared labels by
  `affine/all`'s `toolbar-names.unit.spec.ts`, the highlight by
  `canvas-arrows-move-first.spec.ts`.
- A tool registered tomorrow is in the walk and the press with nothing to do:
  the row is read from what is drawn, item by item, and pressed as a pointer
  presses it; a flag that removes a button removes it from the walk (ADR
  0009).
- A tool whose tooltip is a template, or is emptied while its menu is open,
  must pass `label` to its button, or it is unnamed — which the integration
  spec reports.
- **What stays out of the keyboard's reach.** The controls inside the tools'
  menus and options are `edgeless-tool-icon-button`s that take no focus: the
  frame presets, the connector's modes and styles, the pen's colours and
  widths, the note menu, the shape menu, the mind map styles and import, the
  templates panel's cards. Each would need a keyboard model of its own
  (swatches, sliders, a grid), which this decision does not build. Tab from
  the button reaches only what the browser can focus there, which the
  integration spec lists at each run: the colour button of the curve, pen and
  shape options, a native button of the mind map menu, the templates panel's
  search field; Escape from any of them closes the thing and gives its button
  the focus back. A framework sub-menu's commands stay reachable with Alt+←/→
  and Enter, as from the canvas.
- A canvas shortcut that is not one of the toolbar's keys acts while focus is
  in the toolbar, exactly as it does from the canvas (a Delete removes the
  selected shape): the product owner's rule.
- On a read-only document the toolbar draws nothing, so there is nothing to
  reach (ADR 0051).
