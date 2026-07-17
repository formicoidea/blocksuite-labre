---
'@labre/affine': patch
---

Publish bundles whose ESM specifiers Node can resolve

The compiled bundles emitted specifiers verbatim from the vendored source, so
`dist` shipped extensionless relative imports (`from './shortcuts'`), extensionless
subpath imports (`from 'lodash-es/last'`), and bare imports of bundler-only proxy
directories (`@atlaskit/pragmatic-drag-and-drop/element/adapter`). Bundlers accept
all three; Node's ESM resolver accepts none, so any consumer that let Node resolve
the bundles — a test runner treating them as externalized deps, a bundler-less
import — failed with ERR_MODULE_NOT_FOUND / ERR_UNSUPPORTED_DIR_IMPORT.

`compile-bundles.mjs` now rewrites every emitted specifier to an explicit one and
fails the build on any relative import that resolves to nothing.
