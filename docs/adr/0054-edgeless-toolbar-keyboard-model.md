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
   tooltip), its state (`aria-pressed`: a tool's `active` on the row, a
   chosen option's `pressed` in a menu), its roving
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
5. **What a press does with the focus.** A press that opens a menu from the
   button — any popper the toolbar tracks (a framework's sub-menu, a tool's
   options: frame, connector, pen, note, shape, mind map) — puts the keyboard
   on the menu's first control (§10); Escape closes it and gives the button
   the focus back. The templates panel, which the button appends beside
   itself, keeps the focus on the button, Tab reaching its search field. A
   press that only picks a tool (the eraser) gives the canvas the keyboard
   back. Anything else (undo, the layers pane, a text, add a file) leaves the
   focus on the button. A press that
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
   if that button is gone, to the canvas if the row is. A `focusout` with no
   `relatedTarget` triggers one look a frame later, only in that state:
   Chromium fires it when the focused element is removed (checked in the
   second review of #679); no frame runs while the focus rests. A page that
   lost the focus to the browser is left alone. Not covered: switching the
   editor between page and canvas replaces the whole host, and the focus
   ends on the body both ways — as it does on the base from the canvas
   (`d1ae67217`, measured in the second review); the row cannot hand back a
   focus whose editor is gone.
8. **The pager arrows are not Tab or arrow stops.** The arrows page the row as
   they walk, so every senior tool is reachable without them; they keep their
   names ("Previous tools", "Next tools"), which never change with the page,
   and stay clickable. Their tooltip previews the tool the arrow brings in,
   as in 4.0.0. A click closes that preview until the pointer leaves the
   arrow: rebuilt at each page turn, it used to show at once under the
   pointer resting on the arrow and stay there (#679, criterion 5, found with
   a real mouse in the acceptance). Back on the arrow, the pointer reads the
   preview of the tool it brings in then.
9. **The Alt+←/→ highlight stays** as a shortcut from the canvas, unchanged;
   focus entering the toolbar clears it, so the two rings never show at once.
   In a framework's sub-menu the highlight follows the focus
   (`EdgelessCommandMenu.point`): one current command for Enter, whether the
   keyboard walks the menu from the canvas or from inside. Nothing more is
   announced for it: inside the menu, the focus says it.
10. **The menu model** (#679 acceptance: the product owner could not reach
    a framework's tools, nor the shape types, from the keyboard). One model
    for every menu the row opens, read from what the menu draws
    (`menu/menu-keyboard.ts`, `menuGroups`), held by the toolbar
    (`_onMenuKeydown`), not by each menu:
    - a menu is a row of **groups** in reading order; a group starts at a
      divider or where the controls change component. Its controls are the
      buttons it draws (`role="button"`, a native `button`); a widget with
      keys of its own — the colour grid (`radiogroup`), the width slider — is
      a group of its own whose keys stay its own;
    - opened from the keyboard, the menu takes the focus on its first
      control; opened with the mouse, it takes nothing (§4);
    - ←/→ (and ↑/↓) walk the controls of a group, wrapping; Home / End go to
      its ends; Tab / Shift+Tab go to the next / previous group, and past the
      last or the first close the menu and give its button the focus back,
      as Escape does (APG's menu button, Tab leaving the menu);
    - Enter / Space press the control as a pointer does (§4), and what the
      press did to the menu decides where the keyboard goes, the way a click
      decides it — one rule for every menu: gone once the press has settled,
      the canvas has the keys; still there (an option: a shape type, Pen or
      Highlighter, a mode, a colour), the focus stays on the control, or on
      the one the menu drew in its place. Only while the press is still the
      last thing that happened: a key typed before it settled (Tab, Escape,
      an arrow), a pointer press or the focus leaving the editor keeps its
      own move (fourth review of #679);
    - Escape (or Tab past the last group) on a menu that picked an element up
      (a mind map style) drops it as the mouse's Escape does: the drag
      cancelled, the select tool back, then the menu closed and its button
      focused;
    - the keyboard leaves nothing behind: the `tabindex` it gives a menu
      button is taken back when keyboard mode ends (the menu closed, a
      pointer press, the canvas), so a later click is the click of 4.0.0;
    - inside a menu the model takes only those keys; every other key goes on
      to the canvas, as from the row.
      A menu built from the shared pieces gets the model with nothing to
      declare; a control the menu draws as a plain element must say it is a
      button (`role="button"`, the frame presets) to be reached.

## Consequences

- The keyboard path is held by the integration suite
  (`edgeless/edgeless-toolbar-keyboard.spec.ts`, real Playwright keys and
  mouse): every button pressed by a click, Enter, Space and a held Enter must
  do the same thing; every menu a button opens must take the keyboard, be
  walked to its last control, close on Escape and give the button the focus
  back. The names and the state are held by
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
- **Every menu control is reachable** (§10), held by the integration spec on
  every button of every page: the keyboard enters the menu, reaches every
  control it draws, and Enter on one does what a click does. The buttons of
  the menus are named from their tooltip like the row's (the naming scope of
  `edgeless-tool-icon-button` covers the items of an `edgeless-slide-menu`;
  a template tooltip passes `label`), the mind map's native buttons carry an
  `aria-label` (each style its own name, « Mind Map — Style N », the
  wording its starter template shows), the frame presets say
  `role="button"`. The chosen option is announced as `aria-pressed`: an
  owner binds `pressed` where `active` is the choice (shape types,
  connector modes, Pen / Highlighter, note types; the mind map styles on
  their buttons), never where `active` is a highlight (a framework's
  sub-menu). The width slider, a discrete `affine-slider`, became an ARIA
  slider stepping point to point, and a Tab stop, everywhere it is drawn:
  every use passes a `label` (held by `affine/all`'s
  `slider-names.unit.spec.ts`).
- **What still needs the pointer.** The templates panel's cards are a
  scrolling grid behind a search field, a model of its own (search, then a
  grid walked in two dimensions, then insertion): Tab reaches the search
  field, nothing more. The mind map menu's items, reached and named, place
  by click-to-drag — a press picks the item up and the next click on the
  canvas sets it down — so a keyboard user can pick one but not place it.
- A canvas shortcut that is not one of the toolbar's keys acts while focus is
  in the toolbar, exactly as it does from the canvas (a Delete removes the
  selected shape): the product owner's rule.
- On a read-only document the toolbar draws nothing, so there is nothing to
  reach (ADR 0051).
- **Known limits.** (1) "More Tools" opened with the mouse at a narrow
  width puts the focus in its menu's search field; Escape closes it and the
  focus ends on the body, so the canvas loses the arrows and Space until a
  click. The base does the same (`d1ae67217`); the menu is `popMenu`'s, the
  keyboard path through the row gives the focus back. (2) The focus watch of
  §7 relies on `focusout` at removal; a browser that does not fire it leaves
  those cases on the body, as before this decision. Chromium is the only
  browser the integration suite runs. (3) The mind map styles are read in
  the menu's order, which is the enum's (« Style 1, Style 4, Style 3,
  Style 2 »): their names are the styles' identities, shared with the
  Templates catalogue (lead decision, fourth review: accepted as is).
  (4) `edgeless-toolbar-keyboard.spec.ts` takes about 7 minutes alone, the
  two data-driven "Enter equals click" tests about 2 and 3 of them: each
  control is reached from a fresh menu by the keyboard and by the mouse, so
  that no press inherits another's state.

## Amendment — 2026-11-21: the Tab stop is the button used last; the ring sits whole

The product owner accepted #691 on the acceptance build with three remarks,
answered here. The rule of §4 is untouched: the toolbar takes the keyboard only
in keyboard mode, and after a mouse gesture it is the toolbar of 4.0.0.

1. **The Tab stop is the button used last** (replaces the stop rule of §3;
   the product owner: "start where the user is or where he last was, at the
   level of the toolbar only"). Tab kept starting on the active tool, and a
   placed shape or a picked style gives the select tool back, so nearly
   always on the first button: the whole bar to cross again. The row's one
   Tab stop is now the row button the user last used — the last one the
   keyboard focused, the last one clicked, the last one pressed through the
   Alt+←/→ highlight — for the life of the mounted toolbar; until the row is
   used once, the active tool's, as before. The APG toolbar pattern returns
   focus to the control that last had the focus; counting a click and a
   press through the highlight as well is this library's extension, by the
   product owner's decision. Its known cost: a one-shot button that was
   clicked (Undo, Add file) becomes the stop, and the ring shows where Tab
   landed before any Enter.

   - A tool picked from the canvas (a letter such as `h` or `v`, a chord, the
     select tool given back after placing) moves no stop.
   - A click — the primary button only; a right or middle click moves nothing
     — moves the stop to the clicked button without focusing it and without
     leaving any `tabindex` but the roving one: at every moment exactly one
     row button is `tabindex="0"`, every other and the pager arrows and "More
     tools" `-1`. A click on a pager arrow moves nothing (§8).
   - A press through the highlight finds its button by the highlighted item,
     not by its index: the highlight does not count "More tools", the row's
     places do, so at a narrow width the index named the wrong tool. And
     only an entry read for the tool the item draws now: the senior cells
     are reused across a page turn, another tool inside, and until the row
     is read again their entries name the tool drawn before — a press right
     after the highlight turned the page remembered that one. With no such
     entry yet, the button is remembered once the row is read. In the pen
     and eraser's cell, the button the press lands on, at its centre.
   - The button is remembered by its tool — a senior tool by its name, a quick
     tool by its place, then its place in its item (pen, eraser) — since a
     page turn or a resize draws the row anew. On another page of the senior
     row, the canvas's Tab turns the row to that page and focuses it once
     the page is drawn — unless a key or a pointer press came in between, or
     the keyboard left the canvas, which cancel it. Not drawn at all (a
     resize folded it into "More tools"), the stop is the active tool's
     button, else the first; the memory holds while nobody Tabs in, and a
     resize that draws it again gives it back. The first Tab onto that
     fallback is a focus like any other: it becomes the button used last,
     and the folded tool is forgotten. Flags are read once at mount (ADR
     0009), so a framework a flag turns off is never drawn in that
     editor's life: another editor starts with nothing remembered.
   - Sub-menus are unchanged: a menu opened from the keyboard takes the focus
     on its first control (§10).
   - Nothing is stored — not in the document, not in `localStorage` or
     `sessionStorage`: it is view state of the toolbar.
   - Shift+Tab from the row still gives the canvas the keyboard, Escape still
     gives it back without changing the tool. The browser's own Tab order
     (Shift+Tab from what follows the editor) lands on the stop of the page on
     show; only the canvas's Tab turns the page.
     Held by "the Tab stop is the button used last" in
     `edgeless-toolbar-keyboard.spec.ts`.

2. **A ring sits whole, inside what it marks, concentric with what it
   surrounds.** Two of the rings the keyboard draws did not.

   - The senior tools' buttons are as tall as the bar, their artwork clipped
     at its edges (`DESIGN.md`): the ring, drawn on the button's box, lay on
     the bar's top border and was cut at its bottom. A tool button's ring is
     drawn inside its box (`toolButtonFocusRing`, still 2px, colour
     unchanged), and on a senior tool 2px further in
     (`--edgeless-toolbar-focus-ring-inset`, set by the bar on its senior
     items): every ring of the bar — quick tools, each senior tool on every
     page, "More tools", the pager arrows — lies inside the bar, clear of its
     1px border, clipped by no ancestor. It is a positioned `::after`, above
     the artwork: an outline paints under positioned or transformed
     children, and the note's paper, the file's card and the text covered it
     (seen in the visual check of this amendment). The spec checks this from
     computed style (a positioned box, `z-index` at least 1), a proxy for
     paint order; the real check, pixels of the ring over the artwork, was
     done by eye on screenshots.
   - Every senior tool drawn as one button has one ring geometry, owned by
     the toolbar: its cell's box less 2px a side, whatever box the tool
     gives its button. The cell spans the bar's height, its 1px border
     included, so the ring stands 1px clear of that border (measured).
     Text and Add file draw their artwork past their button's box, and a
     ring on that box crossed the lettering and left the file's card and
     paperclip outside. The bar marks such a
     cell (`data-cell-ring`, read at each sync of the row, since a page turn
     deals other tools into the same cells) and the cell that holds the
     focused button (`data-keyboard-focus`, set on a `:focus-visible` focus
     only, as every other button's ring, cleared on blur);
     the cell's `.cell-ring`, an element of its own, draws the ring and the
     button draws none (`--edgeless-toolbar-focus-ring-display`). Not the
     cell's `::after`: that needs a positioned cell, and a positioned cell
     becomes the containing block of the tool's menu, sized against the bar
     — tried, it broke every senior menu. The unpositioned cell centres the
     ring as a flex item. `:has(:focus-visible)` cannot see a focus inside
     the tool's shadow tree, and `:focus-within` would also match a focus in
     the tool's open menu, so the bar sets the mark. A cell of two buttons
     (the pen and the eraser) keeps one ring per button, each 2px inside its
     button. No artwork moves, no clipping changes.
   - The slide-out menus open inside a senior cell and inherited its ring
     settings: their tool buttons drew the ring 2px inside, over the icon
     (review of #691). The menu resets both for its own buttons; in every
     menu the keyboard reaches, a tool button's ring is its own box.
   - A chosen colour swatch drew its selection ring 27px wide on a 24px
     swatch: 1.5px out on each side, on half pixels, which the browser snaps
     to one side, with 0.5px left to the focus ring — the two rings visibly
     off-centre. Both rings are now drawn from one 28px box centred on the
     swatch, its `::after`, there whether the swatch is chosen or not: the
     selection ring is its border, which only a chosen swatch has (a
     transparent border on every swatch may be forced to a system colour in
     forced-colours mode, every swatch then looking chosen), the focus
     ring its outline 1px outside it. One box cannot snap apart from itself,
     at any device pixel ratio (looked at by eye at 1, 1.25 and 1.5). The
     ring stands 5px outside a 24px swatch, wherever the grid is drawn:
     measured unclipped in the canvas toolbar's menus (the spec's walk), the
     shape's fill and border picker, the connector's stroke picker and the
     note style panel; read from CSS for the database's colour menu and
     carousel, whose grid sits in 4px of padding inside the menu's 8px, the
     menu the only ancestor that may clip (when capped to the window).
   - The slide-out menus clipped the ring of a control at their scrolling
     edges (the first control, the width slider; the last swatch). The strip
     keeps 5px of room inside its clipping edges and scrolls a control the
     keyboard focuses (`:focus-visible`) in with its ring, clear of the slide
     arrows, which reach at most its 8px scroll padding into it. A mouse
     press scrolls nothing: a strip sliding between mousedown and mouseup
     sent the click to another control. With no prefix the content sits where
     it did; after a prefix (the pen menu's pens) the strip's content starts
     5px further right and the menu is 5px wider. The colour grid scrolls its
     own swatch in on an arrow key (a move inside its shadow tree sends the
     strip no `focusin`), wherever the grid is.
     Held by "the focus ring, where the product owner saw it" in
     `edgeless-toolbar-keyboard.spec.ts`, which measures each ring from what
     draws it (`utils/focus-ring.ts`): every button of the bar on every page,
     every control of every menu the keyboard reaches.

3. **Found on the way, recorded.** (a) An Escape typed while a closed menu
   still slides out (its 230ms leave transition) read the menu as open and
   pressed its button again, the menu back: the row forgets what it opened
   the moment its popper closes, whatever closes it (`activePopper`), not on
   Escape alone (fixed here; held by "a tool that gives the select tool back
   after use", two Escapes sent in one task). (b) Not fixed: at a 380px-wide
   toolbar (one senior tool a page, "More tools" shown) → stalls on "Add file" and
   goes no further; it does so on the base too. The ring test walks that
   width only as far as the first senior pages (a `ponytail:` line in the
   spec says where to lift it). (c) A tooltip the resting mouse raised over a
   menu control takes a keyboard press there, since the press is the
   pointer's at what is drawn (§4): Enter then does nothing. Not changed.
