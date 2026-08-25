---
'@labre/affine-widget-linked-doc': patch
---

Importing a zip no longer mangles non-ASCII file names

The zip spec says an entry name is Latin-1 unless the entry raises the UTF-8
flag, and fflate obeys it. Plenty of archivers — the macOS `zip` tool first
among them — write UTF-8 bytes and never raise that flag, so every byte of a
CJK, Cyrillic or accented name came back as its own Latin-1 character: a
document called `笔记.md` arrived as `ç¬è®°.md`, and the doc it created wore
that name too. Such a name only ever holds code points below 0x100, so it is
now turned back into its bytes and decoded again, strictly, as UTF-8; a name
that is not valid UTF-8 — one that really was Latin-1, or one fflate already
decoded from a properly flagged entry — is left exactly as it was.
