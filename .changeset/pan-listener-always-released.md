---
'@labre/affine-gfx-pointer': patch
---

A middle-click pan always releases its `pointerup` listener

Pressing the wheel starts a temporary pan and hangs a `pointerup` listener on
`document` to restore the previous tool when the wheel is released. That
listener removed itself only when the released button was the middle one, so
ending the gesture with any other button — a right-click while the wheel is
down, the most common way to reach the canvas context menu mid-pan — left it
alive on `document` forever.

Every leaked listener holds the tool that was active when its gesture started.
The next unrelated middle-click release then restored that long-dead tool over
whatever the user was doing, and dropped the current selection with it. The
listener is now released whatever button ended the gesture.
