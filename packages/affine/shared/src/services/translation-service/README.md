# Translation service — the i18n seam

The library holds no prose: every human-readable string it produces —
command labels, rule messages, role names, panel chrome — is an **i18n key**
(`com.labre.wardley.validation.change-arrow-against-evolution`). The host
application owns the catalogue and the locale; the library only ever asks it
for a key.

## Host wiring

```ts
import { TranslationExtension } from '@labre/affine-shared/services';

const HostTranslation = TranslationExtension({
  t: (key, params) =>
    i18n.exists(key, params) ? i18n.t(key, params) : undefined,
  language: i18n.language, // BCP-47; Intl formatting + naming conventions
});
```

`params` carries the values of a sentence with holes in it. The fallbacks use
i18next's placeholders (`'Failed to upload {{name}}'`), so a catalogue seeded
from the manifest interpolates as is. Pluralisation is the host's: the library
passes `count` and keeps its English fallback neutral (`'{{count}} element(s)'`).
With no entry, the library fills the fallback itself (`fillPlaceholders`).

Dates and numbers carry no key: they go through `Intl` in `formatLocale(std)`
(`hostLocale(std) ?? 'en-US'`) — the host's full tag (`'fr-CA'`: the region
matters for a date), falling back to English like every string does so a
standalone playground stays deterministic.

Standalone (playground, tests), register nothing: every call site falls back —
chrome falls back to its bundled English wording, framework prose falls back
to the raw key, on purpose (the library never invents the wording of somebody
else's rule; a dangling key is a bug the host has to see).

`t(key)` returning `undefined` or `''` means "no entry" and triggers the
fallback. `language` feeds `hostLanguage()`, which gates suggestions about
words (naming conventions declare the language their motif belongs to).

## Building the catalogue: the key manifest

Do not chase `translateKey` call sites. The library enumerates every key it
can ask for, with its English fallback, without an editor instance:

```ts
import { getTranslationKeyManifest } from '@labre/affine/translations';

for (const { key, fallback, source } of getTranslationKeyManifest()) {
  // key:      'com.labre.validation.map-quality.open'
  // fallback: 'Map quality…' (undefined where the library ships no wording)
  // source:   'command' | 'framework' | 'role' | 'background' | 'rule'
  //         | 'nudge' | 'profile' | 'audit-criterion' | 'reading' | 'tag'
  //         | 'seed' | 'chrome'
}
```

Typical host bootstrap: dump the manifest into the translation pipeline
(seed the `en` catalogue from the fallbacks, translate the rest), and diff
against the shipped catalogue in CI to catch keys a library upgrade added.

### `fallback: undefined` is a refusal, not an omission

**Do not seed those keys into `en`.** Around 22 of the entries ship no
wording: the seven framework names, the Wardley roles, and a handful of
command descriptions. That is the same rule as `translateKey` itself — the
library never invents the wording of somebody else's framework, and a key with
no fallback renders as the raw key precisely so the hole is visible.

Seeding them from the key (or from a machine translation of it) reinvents the
prose the library declined to write, and it does it silently. Route them to a
human instead: they are the short list a product owner actually has to word,
and a pipeline that separates them gets that list for free.

### Bundled distribution: the manifest is composed

`@formicoidea/labre-core` is the editor **minus the frameworks**, so
`getTranslationKeyManifest()` from core answers with core's share only —
roughly 68 keys of 175. The missing 107 belong to the framework bundles, and
each one exports them, exactly as it exports its commands:

```ts
import { getTranslationKeyManifest } from '@formicoidea/labre-core/translations';
import { mergeTranslationEntries } from '@formicoidea/labre-core/std';
import { wardleyTranslationEntries } from '@formicoidea/labre-framework-wardley';
import { edgyTranslationEntries } from '@formicoidea/labre-framework-edgy';

const catalogue = mergeTranslationEntries(
  getTranslationKeyManifest(),
  wardleyTranslationEntries,
  edgyTranslationEntries
  // …one per framework bundle installed
);
```

`mergeTranslationEntries` de-duplicates (first entry wins) and sorts, so the
composed list is identical whatever the order — and identical to what the
monorepo assembly produces from the same parts. Compose the entries of every
framework bundle you **installed**, not of the ones you enabled: a flag toggled
on later must not find holes in a catalogue built once.

In the monorepo there is nothing to compose — `@labre/affine/translations`
already assembles the same parts, which is why the exhaustiveness test below
covers every part.

The manifest is **exhaustive by construction and by test**: data-declared keys
(commands, rules, roles, profiles, nudges, audit criteria, reading
conventions, background labels, and the closed chrome tables behind
template-literal keys) are walked from the same runtime declarations the editor
registers, and `packages/affine/all/src/__tests__/translations/manifest.unit.spec.ts`
scans the whole library source and fails when a used `com.labre.*` key is
missing from the manifest, when a manifest entry is used by nobody, or when a
chrome fallback it restates drifts from the wording a widget actually renders.
It is flag-independent: build one catalogue for the whole library, so a
framework toggled on later finds no holes.

### Where a wording is declared

Each package declares its wordings as named `ChromeWording` constants in its
own `translations.ts`, beside the code that renders them. A non-framework
package's CHROME table joins `PACKAGE_WORDINGS` in `@labre/affine/translations`
under source `chrome`, and its SEEDS — text a creation action writes INTO the
document, never re-rendered once placed — join `PACKAGE_SEED_WORDINGS` in the
same file, under source `seed`. A framework's entries of either kind join its
own `…TranslationEntries` instead (a seed there uses the same
`nodeLabelKey`-style derivation the BPMN precedent above does). `chrome.ts`
keeps only the words several packages share ("Copy", "Card view"). Never write
an inline `['com.labre.…', '…']` tuple at a call site: the manifest cannot walk
it.

**One chrome word, one key.** Before declaring a new `ChromeWording`, check
`chrome.ts` for the same English word — reuse it rather than minting a second
key for it. If the word is not there yet but a wording elsewhere in the repo
already carries it under a different key, that is a duplicate, not two
different words: move the wording to `chrome.ts` (a named constant, added to
`CHROME_WORDINGS`) and turn every other declaration of it into an alias —
`export const OLD_NAME = SHARED_NAME;` — so every call site keeps compiling
under its existing import, and the duplicate key string disappears from the
source. `packages/affine/all/src/__tests__/translations/manifest.unit.spec.ts`'s
"one chrome word, one key" test enforces this: it groups every manifest entry
of source `chrome` by its exact English fallback and fails the moment two
different keys carry the same word, unless that word is a genuine homonym
listed in the test's own `KEPT_SEPARATE_CHROME_WORDS` (with a reason). A real
homonym — the same English spelling, a different meaning at each call site —
gets added there instead of merged; everything else gets reused. A framework's
own table is the one exception (frameworks never import each other), so a
framework-owned duplicate is not something this rule can fix.

### The other direction: literals with no key

`packages/affine/all/src/__tests__/translations/literals.unit.spec.ts` scans
the source for displayed literals that carry no key (ADR 0023). Anything it
finds must be listed in `literals.baseline.json`, and that list can only
shrink: a new literal fails the test, and so does a listed one that has gone.
Translating a string therefore means running
`UPDATE_I18N_BASELINE=1 yarn vitest run literals` from `packages/affine/all`.
That command only removes entries, never adds them.

Related manifests, same seam philosophy (typed, serializable, render-free):
`getShortcutManifest` (Settings › Shortcuts) and `getCommandManifest`
(catalogue / palette / agent), both under `@labre/affine`.

## Static configs: the `…Wording` sibling fields

A widget that renders a plain data literal (a toolbar action's `label`, a
slash-menu item's `name`) has no place to call `translateKey` at the point the
literal is written — the literal is data, not a render. The pattern is a
sibling field carrying the key/fallback pair, resolved by the widget when it
actually draws the literal; the static field itself stays untouched, so it
keeps being what tests and identifiers key on.

**Toolbar actions** (`packages/affine/shared/src/services/toolbar-service/action.ts`):
`ToolbarAction.labelWording` / `.tooltipWording`, resolved in `combine`
(`packages/affine/widgets/toolbar/src/utils.ts`) — a declared wording WINS over
the static `label` / `tooltip` left beside it (the static one is already the
wording's own English fallback, so the two never disagree).

**Slash menu** (`packages/affine/widgets/slash-menu/src/types.ts`):
`SlashMenuItemBase.nameWording` / `.descriptionWording`, and
`SlashMenuTooltip.captionWording`, resolved in `slash-menu-popover.ts` at
render. `name` stays the item's English identity — what `searchAlias`,
`slashItemClassName` and any test selector key on — search matches the
RESOLVED name, the English `name`, and `searchAlias` together
(`slashItemMatchesQuery` in `utils.ts`), so neither a translated nor a
habitual query comes up empty. A package registers its own
`readonly ChromeWording[]` table in its own `translations.ts` (see
`packages/affine/widgets/slash-menu/src/translations.ts`) and lists it in
`PACKAGE_WORDINGS` (`packages/affine/all/src/translations.ts`) — the same
"declared once, walked everywhere" rule `CHROME_WORDINGS` already follows.

**Templates-panel tiles** (`packages/affine/gfx/template/src/toolbar/template-type.ts`):
`Template.nameKey`, resolved by `resolveTemplateName`
(`./toolbar/resolve-name.ts`) BEFORE the `commandId`-derived path — a
hand-composed template (a worked scene, an example map) carries no command to
read a label from, so this is the only seam that reaches its tile's name.
`name` stays the template's stable English identity (the drag payload, the
`repeat` key, the search fallback); a framework declares its own `nameKey`
constants in its `translations.ts`, joining its `…TranslationEntries` under
source `chrome` — never a framework importing another's.

## A `ServiceProvider` with no `std`

An adapter or transformer (`ClipboardAdapter`, the markdown/HTML importers and
exporters, a `Store`-level transformer with no editor host) has a
`ServiceProvider` but no `BlockStdScope` to call `translateKey` with.
`resolveWording(provider, wording)`
(`packages/affine/shared/src/adapters/utils/wording.ts`) is `translateKey`'s
own contract over that narrower type: `provider?.getOptional(TranslationProvider)`
instead of `std.getOptional`, `undefined` resolving exactly like no host
registered one.
