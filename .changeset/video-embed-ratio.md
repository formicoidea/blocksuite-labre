---
'@labre/affine-block-attachment': minor
'@labre/affine-shared': minor
---

A video shown as an embed keeps its own proportions (#738, port of upstream
toeverything/AFFiNE a28cad2). The video is no longer cropped: it is fitted
inside its box (`object-fit: contain`). « Turn into embed view » on a video
first reads the clip's own size (a few milliseconds usually, at most 3
seconds), then switches to an embed whose box has the clip's ratio at the
card's width (752), a portrait clip getting a portrait box; when the size
cannot be read, the box keeps the card height (544), as before. It is one
undo step, and nothing is written when something changed during the read
(another file, a resize by anyone, the view switched, an undo, a deletion, a
read-only document); a second click during the read does nothing more.
« Replace » by a video keeps the frame it replaces, in one undo step, and
never reads the clip. On a canvas, a video embed is painted at its bound's
ratio instead of as a card contained in it (ADR 0044, amendment of
2026-11-24); every other card is unchanged.

Video embeds saved before keep their 752 × 544 box and are not rewritten on
load: a clip of another ratio now shows bars on two sides (letterboxed) where
it was cropped before.

New in `@labre/affine-shared/utils`: `readVideoSize(blob, timeoutMs = 3000)`,
beside `readImageSize`, the video's natural size or `null` when it cannot be
read in time. New optional third parameter of an embed config's `action` and
of `AttachmentEmbedService.convertTo`: `{ keepBound?: boolean }`
(`AttachmentEmbedConvertOptions`, exported by the package), for a caller that
writes the frame itself in its own transaction. A config written for the
two-parameter `action` keeps compiling.
