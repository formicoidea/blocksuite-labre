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
  t: key => i18n.exists(key) ? i18n.t(key) : undefined,
  language: i18n.language, // BCP-47; gates language-scoped naming conventions
});
```

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
  //         | 'nudge' | 'profile' | 'audit-criterion' | 'reading' | 'chrome'
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
roughly 84 keys of 197. The missing 113 belong to the framework bundles, and
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

Related manifests, same seam philosophy (typed, serializable, render-free):
`getShortcutManifest` (Settings › Shortcuts) and `getCommandManifest`
(catalogue / palette / agent), both under `@labre/affine`.
