---
'@labre/affine-block-surface': patch
'@labre/affine-gfx-wardley': patch
'@labre/affine': patch
---

`ReadingProfile.frame.label` and `frame.none` are optional again: 0.44.0's requirement is withdrawn before publication, so a reading profile written against 0.43 (`{ backgroundRole, background, axis }`) compiles unchanged and its panel shows what 0.43 showed, "Evolution phase" and "Not on a framework background — no phase to read.". That default wording is now owned by the reading engine (`READING_FRAME_DEFAULT_WORDING`, `readingFrameWording`) and ships with core whether or not the Wardley bundle is installed; Wardley inherits it. Keys and English are unchanged (`com.labre.reading.field.phase`, `com.labre.reading.phase.none`).
