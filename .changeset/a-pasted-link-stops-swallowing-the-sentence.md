---
'@labre/affine-block-database': patch
---

A link pasted into a database cell no longer swallows the sentence around it

Pasting into a title or rich-text cell was all-or-nothing: if the whole
clipboard happened to parse as a URL the entire paste became one link,
otherwise nothing was linked at all. So `docs:https://example.com` arrived as
flat text with a dead address in it, and `(https://example.com).` became a link
that quietly included the closing bracket and the full stop.

The paste is now read segment by segment: prose stays prose, addresses become
links, and the punctuation hugging an address stays outside it. A paste that is
nothing but a single address still resolves to a linked doc when it points at
one, exactly as before. Title cells also claim the paste before the document
clipboard sees it, so a paste there can no longer leak into the page.
