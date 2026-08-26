---
'@labre/affine-model': minor
'@labre/affine-gfx-ddd-shared': minor
'@labre/affine-gfx-ddd-event-storming': minor
'@labre/affine': minor
---

feat(edgeless): an event storming board carries a timeline, and its flows are typed

Event Storming now has a **board** to be stormed on — a wide white roll, 3200 ×
1400, freely stretchable in either direction — and it carries the one thing the
method actually has a frame of reference for: a **time axis** along the bottom,
running left to right. Nothing else is graduated, on purpose. How high a sticky
sits on the wall means nothing, and drawing lanes to suggest it did would invent
a meaning the framework does not have; swimlanes are deliberately left for a
later release rather than half-shipped. The board is created from a new first
entry in the Event Storming palette.

The palette also gains the **Aggregate**, the pale-yellow sticky a command lands
on and the thing that raises the event. Without it the canonical sentence —
command, aggregate, domain event — could not be drawn at all. It is created
larger than the others, as it is on a real wall, and in a paler yellow chosen so
that the three yellows of the notation (constraint, actor, aggregate) can be told
apart at a glance rather than only by position.

**Flow changed gesture.** It used to drop a little arrow in mid-air, attached to
nothing: it looked like the notation and said nothing, and the user still had to
drag both ends onto the stickies by hand. Choosing Flow now arms the link tool
and says which way to drag — from what happens first to what follows — and the
arc the user draws references the two stickies for real.

That is what makes the wall **readable by the tool**, and three checks come with
it. It says so when a flow runs backwards along the timeline, when an arc is not
one of the nine sentences Event Storming says (an actor issues a command; the
command lands on an aggregate or an external system; that raises a domain event;
the event triggers a policy or feeds a read model), and when two stickies cover
each other badly enough to hide a word. Everything else stays silent: an arrow
drawn at a **hotspot** or a constraint is somebody parking a question, not making
a claim, and the tool has nothing to say about it — nor about an arc onto a note,
onto a plain rectangle, or onto anything the model has not named. Two flows drawn
between the same two stickies are not reported either: a wall gets a line drawn
twice while three people talk at once.

There is deliberately **no check on how stickies are named**. "Order placed"
versus "Place order" is the first thing a facilitator corrects and the most
tempting rule of the lot — and reading marker-pen prose in whatever language the
room speaks is not something a tool can do without being wrong every fifth
sticky. It is a checklist item instead, beside four others the tool cannot judge
for you: the timeline has been read out loud and reordered, every hotspot has
been discussed, the actors and external systems are identified, the pivotal
events are marked.

Three levels of requirement ship with it, chosen per board from the board's own
toolbar, because Event Storming is not one activity but three. **Big Picture
(Sketch)** (the default) says nothing at all — a Big Picture is supposed to be
chaotic, and a tool arguing with that hand is judging one stage of the workshop
by the criteria of a later one. **Process modelling** turns on the timeline and
only the timeline: that stage is about ordering the frieze, and the kinds are
still being settled. **Software design** turns on all three.

**Nothing already drawn changes.** Walls stormed before this release carry no
roles, so not one of them is judged, and the old flow arrows keep rendering
exactly as they are — they are simply drawings now. Redrawing one with the new
tool is what makes it a statement.
