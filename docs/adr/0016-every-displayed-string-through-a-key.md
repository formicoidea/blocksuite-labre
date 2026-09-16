# ADR 0016 — Every string the library displays goes through a key

- Status: **accepted** (2026-09-11)
- Deciders: Mathieu Jolly
- Milestone: chantier « clés de traduction » (branch `i18n-cles-2026-09`)
- Related ADRs: [0007](0007-universe-tag-defs-format.md) (`labelKey`, not
  `label`), [0009](0009-reversed-flag-contract.md) (a stored document never
  depends on tooling).

## The question

The translation seam (`TranslationExtension`, `translateKey`, the key manifest)
existed, and rule R30 said every user-visible string is a `com.labre.*` key.
Nothing enforced it: `manifest.unit.spec.ts` checks the keys that are
written, never the strings that are not. The 2026-09-11 audit counted 1 955
displayed strings with no key: 1 433 inherited from AFFiNE, whose editor never
had i18n, and 522 written for Labre. A French host showed English toolbars,
English error toasts and English seeds on the canvas.

Two gaps in the seam also made some strings untranslatable in principle:
sentences with a value in them ("Failed to upload {{name}}"), and dates and
numbers.

## Decision

1. **Interpolation crosses the seam.** `TranslationService.t(key, params?)`,
   and `translateKey(std, key, fallback, params?)`. Placeholders are i18next's
   `{{name}}`, so a host catalogue seeded from the manifest's fallbacks works
   unchanged. The host interpolates and pluralises (on `count`) its own
   translation. The library only fills its English fallback, where plurals stay
   neutral ("{{count}} element(s)"). The parameter is optional: an existing
   host still compiles.
2. **Dates and numbers use `Intl`, not keys.** `hostLocale(std)` returns the
   host's full BCP-47 tag (the region matters for a date). `hostLanguage`
   keeps its narrower job: gating suggestions about words.
3. **Three forms of key, by where the string lives.** Rendered with `std` at
   hand: `translateKey(std, ...WORDING)`. In a static config a widget renders:
   a sibling `…Wording` field (the toolbar's `labelWording` precedent, extended
   to the slash menu). Written into the document (a seed): resolved at
   placement by the creation action. **A model default never changes**: the
   creation site writes the translated value, so existing documents keep their
   text and `packages/affine/model` is not touched.
4. **Wordings are declared per package.** Each package's `translations.ts`
   declares its named `ChromeWording` constants, and
   `packages/affine/all/src/translations.ts` walks them (`PACKAGE_WORDINGS`).
   Frameworks keep their own `…TranslationEntries`, so a bundled host gets a
   framework's words with the framework bundle.
5. **A ratchet keeps the hole closed.** `literals.unit.spec.ts` scans the
   source for the usual shapes of a displayed literal (lit text nodes,
   `aria-label`/`title`/`placeholder`… attributes, `label`/`tooltip`/`name`…
   properties, toasts). A literal equal to a manifest fallback counts as
   covered. Every other literal must be listed in `literals.baseline.json`,
   under `kept` (the product owner decided never to translate it), `deferred`
   (a postponed AFFiNE surface) or `pending`. A new literal fails the test. So
   does a listed one that no longer exists, which means the list can only
   shrink.

## Seeds and the glossary

Every seed gets a key, including the terms of art a framework keeps in English
(Wardley « Pipeline », the DDD context-map patterns…). Keeping them English is
a wording decision for the host's catalogue, not an exception in the library.
Another language may decide otherwise, and the library has no business
deciding for it. The French glossary travels to the host as information.

## Rejected

- **Splitting sentences into fragments** ("drawn", "carried") instead of
  interpolating. It freezes English word order into every language, and the
  audit found 66 such sentences. The existing count fragments of the import
  summary stay as they are; they are not worth a migration.
- **One central chrome table.** It would hold about 700 wordings in one file
  that every block edits, and no package would own its words.
- **A process-wide translator** (a module-level `t()` for configs without
  `std`). It is a second source of truth beside the DI provider, and it breaks
  as soon as two editors on a page are served in different languages.
- **A precise AST-based detector.** A regex heuristic plus a shrinking list
  catches what matters: a new English string on a known shape. The human
  inventory remains the reference for everything else.

## Consequences

- A host adapter should forward `params`:
  `t: (key, params) => i18n.exists(key, params) ? i18n.t(key, params) : undefined`.
- A string that matches no detection shape can still slip through. The
  heuristic's ceiling is named in the spec.
- Postponed surfaces (data-view, database, table, the YouTube, Loom, Figma
  and GitHub embeds, the mobile keyboard toolbar) stay English until their own
  project. They are pinned in `deferred`, so they cannot grow unnoticed.
