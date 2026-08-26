---
'@labre/affine-gfx-pointer': patch
---

The board slides under a finger on a touchscreen

On a tablet or a convertible, dragging the edgeless canvas with one finger did
nothing: the selection tool answered the gesture with a rubber band, and the
board stayed exactly where it was. Only two fingers moved anything, through the
pan and pinch gestures the edgeless root handles itself.

A one-finger drag that starts on bare canvas now borrows the pan tool for as
long as the gesture lasts — the same borrow the middle mouse button already
used — and hands the selection tool, and the selection it was holding, back
when the finger lifts.

The gesture is only borrowed where nothing else wants it. A finger landing on
an element still moves that element, so dragging a Wardley or EDGY node by hand
is unchanged; a finger on any tool other than the selection tool still draws,
since bare canvas is precisely where brush, shape, connector and the framework
tools do their work; a second finger is still left to the two-finger pan and
pinch; and a tap remains a tap. Mouse and space-bar panning are untouched.
