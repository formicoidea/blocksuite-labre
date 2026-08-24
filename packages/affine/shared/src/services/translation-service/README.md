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

The manifest is **exhaustive by construction and by test**: data-declared keys
(commands, rules, roles, profiles, nudges, audit criteria, reading
conventions, background labels) are walked from the same runtime declarations
the editor registers, and `packages/affine/all/src/__tests__/translations/manifest.unit.spec.ts`
scans the whole library source and fails when any used `com.labre.*` key is
missing from the manifest, or when a chrome fallback it restates drifts from
the wording a widget actually renders. It is flag-independent: build one
catalogue for the whole library, so a framework toggled on later finds no
holes.

Related manifests, same seam philosophy (typed, serializable, render-free):
`getShortcutManifest` (Settings › Shortcuts) and `getCommandManifest`
(catalogue / palette / agent), both under `@labre/affine`.
