---
'@labre/affine': minor
'@labre/affine-gfx-wardley': patch
'@labre/affine-shared': patch
---

feat(blocks): every key the library will ever ask for, on one list

A host wiring `TranslationProvider` had no way to build its catalogue except
chasing `translateKey` call sites and `labelKey` declarations across the repo
— and no way to know a library upgrade had added one. This slice closes the
seam from the other side: the library now says, out loud and exhaustively,
which keys it can ask for.

- **`getTranslationKeyManifest()`** (`@labre/affine/translations`) — the i18n
  sibling of `getShortcutManifest` / `getCommandManifest`: every
  `com.labre.*` key with its English fallback and its source
  (`command`, `role`, `rule`, `profile`, `nudge`, `audit-criterion`,
  `reading`, `background`, `framework`, `chrome`), enumerable without an
  editor instance and flag-independent, so one catalogue serves whatever a
  host later toggles on. Data-declared keys are WALKED from the same runtime
  declarations the editor registers — a key added to a rule or a command
  appears by construction. The widget chrome literals, which live in lit
  templates, are restated once; a unit test scans the library source and
  fails when a used key is missing from the manifest or a restated fallback
  drifts from what the widget renders.
- `@labre/affine-gfx-wardley` now exports `WARDLEY_BACKGROUND` (its labels
  were already public data through `WARDLEY_READING`; the manifest walks it
  under its own name).
- The translation service grew the README the seam deserved
  (`packages/affine/shared/src/services/translation-service/README.md`):
  host wiring, fallback contract, and how to bootstrap a catalogue from the
  manifest. The service moved from `translation-service.ts` to
  `translation-service/index.ts` to house it — the barrel export is
  unchanged, no import moves.
