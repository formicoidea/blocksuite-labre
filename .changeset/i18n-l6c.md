---
'@labre/affine-components': minor
'@labre/affine-rich-text': minor
'@labre/affine-shared': minor
'@labre/affine-inline-latex': minor
'@labre/affine-inline-link': minor
'@labre/affine-inline-mention': minor
'@labre/affine-inline-preset': minor
'@labre/affine-inline-reference': minor
'@labre/affine-inline-footnote': minor
---

feat(blocks): the shared component library, rich text and the inline nodes (link, reference, mention, latex, the text-format bar, the footnote popup) resolve their chrome, placeholders, aria-labels, toasts, tooltips, dropdown labels, empty states, through the translation seam (translateKey, ADR 0016) instead of hard-coded English. Most of these components have no std of their own; where one now renders inside the editor's DOM it consumes stdContext (the same seam block-caption.ts already used), so with no provider registered every surface reads exactly as it did before.

ResourceController.blob()'s "Image not found" / "Failed to retrieve Image" pair becomes one key per kind times message (Blob, File, Image, six keys total): the kind set is closed and the seam has no grammar to recompose a sentence from a noun, so each whole sentence gets its own key rather than a parameterised hole. The highlight menu's and icon picker's shared colour names, the icon picker's eight emoji-mart group names, and the Confirm/Cancel/Save/Reset verbs shared by the two embed-card modals and the reference popup, are each declared once and reused rather than re-minted per caller.

rich-text/src/conversion.ts's text-block primitive names and descriptions (Text, Heading 1 through Heading 6, Bulleted List, Numbered List, To-do List, Code Block, Quote, Divider, the one list the slash menu and the format bar's Turn into menu both read) move to a new Block types section of chrome.ts's shared CHROME_WORDINGS, so the text-block packages (blocks/note, blocks/paragraph, blocks/list, widgets/slash-menu) can point at the same keys instead of minting their own. The LaTeX equation's empty/error placeholders and the untitled-document fallback are declared there too, for the same reason.

Left untouched, with the reason: the date-picker (components/src/date-picker) is rendered only by the postponed data-view/database/table surfaces; the "A / C" and "e / t" notation letters, SeniorTool.name, and the resize-handle aria-labels are PO decisions out of scope for every lot.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
