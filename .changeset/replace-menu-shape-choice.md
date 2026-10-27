---
'@labre/affine': minor
---

The canvas image toolbar now has one "Replace" menu instead of two buttons. "Replace with image" puts another picture in the image, from the host's image library when one is connected or from the system file chooser otherwise, so it is available without a host too; "Replace with shape" opens a sub-menu of the shape tool's shapes (rectangle, ellipse, diamond, triangle, polygon, rounded rectangle) and puts the chosen one in the image's place, connectors kept. The new command `canvas.image.replaceWithImage` reaches the same action from the palette, and `canvas.image.replaceWithShape` accepts optional `shapeType` and `radius` params (a rectangle when absent). The page image toolbar's "Replace" is now offered without a host as well, falling back to the file chooser.
