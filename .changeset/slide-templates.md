---
'@labre/affine': minor
---

Templates panel: a built-in **Slides** category of 25 16:9 slide masks (cover, section, statement, agenda, text and image, columns, image cards, key figures, timeline, roadmap, process, 2 × 2 matrix, Venn, market size, org chart, pricing, logo wall, quote, testimonials, team, contact…). Each mask inserts one 1600 × 900 frame titled after the mask, holding its title, texts, dashed image zones, a footer and a slide number written at insertion from the frame's place in the deck. Colours are base-palette pairs, so a slide follows the dark canvas. Every word is a `com.labre.template.slides.*` key with an English fallback (the quote slide reuses `com.labre.block-type.quote`); a host catalogue adds the French. `Template` gains an optional `keywords` list, and `makeTemplateSnapshot` an optional list of surface child blocks (the frame).
