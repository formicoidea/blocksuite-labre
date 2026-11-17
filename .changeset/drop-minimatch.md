---
'@labre/store': patch
---

`minimatch` is no longer a dependency of any published package, so the `brace-expansion` advisories it carried stop reaching hosts through `@formicoidea/labre-core` (#667). The store matches the flavour patterns of a schema's `parent` / `children` lists itself, with the same answers on every pattern the library's schemas use: `*` (any run of characters but `/`) and a trailing negation `!(a|b)` (`affine:embed-!(synced-doc)` in the edgeless text schema). This is a narrowing for a host that registers its own block schemas: `?`, character classes, braces and a `!(…)` followed by more pattern are now read literally (such a pattern matches only the identical flavour), and `**` acts as `*`.
