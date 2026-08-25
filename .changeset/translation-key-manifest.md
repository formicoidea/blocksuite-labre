---
'@labre/affine': minor
'@labre/std': minor
'@labre/affine-gfx-wardley': minor
'@labre/affine-gfx-edgy': minor
'@labre/affine-gfx-cynefin-estuarine': minor
'@labre/affine-gfx-bpmn': minor
'@labre/affine-gfx-ddd-event-storming': minor
'@labre/affine-gfx-ddd-core-domain': minor
'@labre/affine-gfx-ddd-context-map': minor
'@labre/affine-block-surface': patch
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
  fails when a used key is missing from the manifest, when a manifest entry
  is used by nobody, or when a restated fallback drifts from what the widget
  renders.
- **The manifest is COMPOSED, not centralised.** Each framework package
  exports its own contribution (`wardleyTranslationEntries`,
  `edgyTranslationEntries`, …) and the core manifest assembles the chrome's
  entries with the frameworks' — the same shape the command registry already
  has, and for the same reason: `@formicoidea/labre-core` is the editor minus
  the frameworks, so a manifest that named them from the core side would be
  complete in the monorepo and 107 keys of 175 short in the distribution hosts
  actually consume. `scripts/build-bundles.mjs` strips the groups from core's
  copy exactly as it strips the command groups, and a bundled host composes
  with `mergeTranslationEntries` (`@labre/std`, new).
- The chrome wordings that sit behind template-literal keys (violation
  severities, exemption scopes, relation sides) are now EXPORTED tables the
  manifest walks rather than wordings restated a second time — which is what
  lets the drift check reach them.
- The translation service grew the README the seam deserved
  (`packages/affine/shared/src/services/translation-service/README.md`):
  host wiring, fallback contract, how to bootstrap a catalogue from the
  manifest, how to compose it in the bundled distribution, and why the 22
  entries with no fallback must not be seeded into `en`. The service moved
  from `translation-service.ts` to `translation-service/index.ts` to house it
  — the barrel export is unchanged, no import moves.
