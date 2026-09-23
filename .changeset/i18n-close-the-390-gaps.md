---
'@labre/affine-shared': patch
'@labre/affine-widget-slash-menu': patch
'@labre/affine-gfx-template': patch
'@labre/affine-block-embed': patch
'@labre/affine-block-embed-doc': patch
'@labre/affine-block-surface': patch
'@labre/affine-components': patch
'@labre/affine-widget-edgeless-toolbar': patch
'@labre/affine-gfx-shape': patch
'@labre/affine-gfx-mindmap': patch
'@labre/affine-gfx-text': patch
'@labre/affine-gfx-connector': patch
---

Twenty-five strings a French host still read in English now go through the
translation seam: the colour picker's Heavy row, the slash menu's List and
Style headers, the five "Other" template tiles, the embed error card's
sentence, the SVG import's three refusals, the two "Untitled" linked-doc
titles, and the accessible name of every toolbar menu (which used to read
"changer le type de forme-menu"). New keys, English fallbacks letter for
letter what shipped — a host with no catalogue sees no change.

New keys: `com.labre.palette-name.heavy-{red,orange,yellow,green,blue,purple,magenta}`,
`com.labre.slash-menu.group.list`,
`com.labre.template.name.{swot,kanban-board,business-model-canvas,fishbone,gantt-chart}`,
`com.labre.embed.iframe.error.{no-embed-data,invalid-url,message}`,
`com.labre.interchange.svg.error.{malformed-xml,not-svg,sanitized-away}`,
`com.labre.interchange.import.default-name`, `com.labre.menu-aria.style`,
`com.labre.text-toolbar.alignment-menu`,
`com.labre.shape.toolbar.switch-type-menu`,
`com.labre.mindmap.toolbar.layout-menu`,
`com.labre.connector.toolbar.{start-point-style,end-point-style,shape}-menu`.
