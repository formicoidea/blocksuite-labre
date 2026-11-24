---
'@labre/affine-block-image': patch
---

Importing a Notion HTML export no longer turns user avatars into image
blocks. Notion exports a person (a database person cell, a "created by"
property, a mention) as a small `img.user-icon` beside the name; the importer
now skips that image and keeps the name. Other images import as before.
Fixes #734 (upstream toeverything/AFFiNE#15899).
