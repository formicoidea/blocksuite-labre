---
'@labre/affine-shared': minor
'@labre/affine-block-embed-doc': patch
---

Stop the linked-doc preview from spinning forever when the referenced doc isn't
loaded (#37). The embed-linked-doc and embed-synced-doc cards now wait for the
doc's content for a bounded time and then degrade to a title-only card instead
of an indefinite loader.

Adds a host content-resolution seam: `LinkedDocContentResolverExtension` lets an
app that doesn't preload its whole corpus hydrate a referenced doc on demand
(`resolve(docId)`) and tune the fallback timeout (`timeoutMs`, default 8000ms).
When the resolver supplies the content, the preview renders it; otherwise it
degrades cleanly.
