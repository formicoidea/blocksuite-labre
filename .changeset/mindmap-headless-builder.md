---
'@labre/affine': minor
---

A mind map can be built with no editor: `buildMindmap(tree, { measure, at, style, layoutType, local })`
on the new core subpath `@labre/affine/gfx/mindmap/interchange` returns the
elements the toolbar's mind map writes (one styled `shape` per node, sized as
`fitContent` sizes it and placed by the view's layout, then the `mindmap`
element naming them by local id). The caller injects the text measurement
(`MindmapTextMeasure`: a line's width and a line's height in the style's font);
the library has no font metrics without a DOM. `materializeInterchangeImport`
now rewrites a mind map's `children` and their `parent` onto the minted ids, as
it does a group's. The mind map style getters (`mindmapStyleGetters`,
`MINDMAP_NODE_MAX_WIDTH`, `NodeStyle`…) are on `@labre/affine/model/headless`;
`MindmapStyleGetter.getNodeStyle` takes `MindmapNode | null`. ADR 0045,
amendment of 2026-11-10; issue #662.
