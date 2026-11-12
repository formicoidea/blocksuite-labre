---
'@labre/affine-components': minor
'@labre/affine-block-callout': minor
'@labre/affine': minor
---

One emoji picker: the Emoji tab of `affine-icon-picker`, and so of
`openIconPicker`, is now emoji-mart's picker, the one a callout always opened
(search, category bar, "Frequently used", skin tones, preview line), and a
callout's icon opens `affine-icon-picker` on that tab alone. `openIconPicker`
keeps its options, its result (`IconData`, `null` for Remove, `undefined` on a
cancel) and its Escape handling. What a host may notice: the popup is 352×435
(was 340×400); emoji recents now live in emoji-mart's `emoji-mart.frequently`
instead of `affine:icon-picker:recent-emojis`, `rememberRecent: false` also
hides the "Frequently used" row, and the chosen skin tone is remembered in
`emoji-mart.skin`. The picker hands emoji-mart its dataset and its words, so
opening it makes no network request. The element gains `tabs` (for instance
`['emoji']`). Eleven new keys translate emoji-mart's chrome:
`com.labre.emoji-picker.frequent`, `.search-results`, `.no-results-title`,
`.pick`, `.skin.choose` and `.skin.1` to `.skin.6`. Removed: the callout's
`affine-emoji-menu` element, and from `@labre/affine/components/icon-picker`
(not yet in a release) `getEmojiGroups`, `filterEmojiGroups`, `emojiUnicode`,
`SKIN_TONES`, `RECENT_GROUP_NAME`, `RECENT_EMOJIS_KEY`, `EmojiGroup` and
`PickerEmoji`, which drew the emoji grid it replaces.
