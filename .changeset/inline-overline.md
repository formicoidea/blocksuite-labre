---
'@labre/affine-inline-preset': minor
'@labre/affine-shared': minor
'@labre/affine': minor
---

Rich text gains overline (ADR 0030 §5), declared and painted the way
underline is: a new `overline` inline attribute (`OverlineInlineSpecExtension`,
`toggleOverline`), an Overline button in the format bar beside Underline (and
the slash menu's style items, which list the same formats), composed into the
run's `text-decoration`. No default keyboard chord: a host binds one through
the shortcuts pane. HTML export writes `text-decoration: overline` and HTML
import reads it back; Markdown cannot say it and drops it, keeping the words.
The attribute is affine-level only — the store's base text attributes are
unchanged — so an older client keeps the attribute in the document and paints
the run without the line. It reuses the key `com.labre.text-format.overline`
("Overline").
