---
'@labre/affine-widget-toolbar': patch
---

fix(edgeless): a row is also what its entries say, not only which entries it has

PO recette of 25/08/2026, second point. The previous pass stopped the flicker on
a selected COMPONENT's toolbar, and the PO confirmed it. On the row of a Wardley
map's BACKGROUND — the one carrying the display toggles, the "Validation"
dropdown and the level of requirement it names — the toolbar went on flapping.
His question was the right one: the answer was never generalised.

**Why it was not.** The previous pass decides whether a re-render is a new row
by comparing a signature of the row's entries: their ids, their words, their
icons, their priorities. For a component's row that is a complete description —
every entry on it is one the WIDGET draws, so listing them is listing their
widths, and two renders with the same list are two renders of the same row. The
background's row is mostly entries the widget does NOT draw: a framework groups
its six toggles behind one entry, and the level of requirement is a dropdown
that names the profile in force on its own trigger. For that row the list says
nothing at all about what the row costs.

**Measured, on the row the PO pointed at.** `Sketch` and `Strict` are the same
entry with the same id, seventy-four pixels and sixty-four pixels wide. A map
given a gradient variant grows a sixth toggle inside the same grouped entry —
one whole button, same list, same signature. So the row could change by thirty
pixels while the plan on screen, and the measurements that plan was arithmetic
on, went on describing the row it used to be: with the room set ten pixels above
the row's width, adding the toggle put the row six pixels outside the room it
had been given, and nothing measured it again. Every later replan — every
accalmie of every gesture — then started from those stale numbers, which is the
row settling on one composition and correcting itself out of another.

**What a row is, in two values.** Which entries it HAS decides whether a PLAN
still applies — a plan is a list of entry ids. What those entries SAY decides
whether a MEASUREMENT still applies. They are now asked separately:

- entries changed → a new row, planned from scratch, exactly as before;
- **only what they say changed → the plan stays on the row** and the row is
  re-measured where it stands. What the plan took off is added back from the
  numbers that made it, so the row is measured whole without ever being SHOWN
  whole — no undegraded frame, which is the flash the previous pass removed;
- neither → free, which is what makes a gesture's re-renders cost nothing.

**And what a row says is a value, never an identity.** An opaque entry only says
what it says once its template has been built, and that template is a fresh
object on every single render — comparing those would make every rebuild a new
row and bring the per-frame flash back on every toolbar in the editor. So the
template is walked for the things that end up as characters on the row: its
words and its numbers, plus a stable name for each template shape. Event
handlers are dropped (a fresh closure per render is how one is written) and so
are booleans (`?active` changes how an entry looks, never how wide it is) and
anything else that is an object rather than something to read.

Nothing here names a block, a framework or a dropdown: it is the same treatment
for every row, and the components' row behaves exactly as it did — the previous
passes' tests pass unchanged, including "a re-render does not put the word back,
not even for a frame".
