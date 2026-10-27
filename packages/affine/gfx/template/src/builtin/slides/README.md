# Slide masks

The built-in **Slides** category of the Templates panel: 16:9 masks a deck
starts from. Each mask is one 1600 × 900 frame (the frame menu's `16:9`
preset) holding its title, texts, dashed fill zones, rules, a footer and a
slide number. Masks are data (`masks.ts`), projected by one builder
(`build.ts`) with one typography and one palette (`consts.ts`).

The set was drawn from the PO's reference deck, 146 pitch.com-style slides,
clustered into layout families. One mask per family that frames, shapes,
texts and connectors can build; the rest is deferred below.

A **placeholder** mask stands for artwork the canvas does not draw (a chart,
a photo, a device frame): it keeps the place with the same dashed grey zone a
picture gets, labelled `Chart`, `Image` or `Screen`, and the author replaces
the zone with the real thing (the shape toolbar's "Replace with image"). The
Gantt plan duplicates the `Other` → Gantt chart template on purpose: a deck
wants it as a slide, in the deck's own type and paper.

## Families

| Family                | Reference slides   | Mask                             | Status      |
| --------------------- | ------------------ | -------------------------------- | ----------- |
| Cover                 | 1, 3               | `cover` (Cover)                  | built       |
| Cover with picture    | 2, 5, 6, 7         | `cover-image` (Cover with image) | built       |
| Section divider       | 4, 6, 7            | `section` (Section), inverse     | built       |
| Statement             | 9, 10, 33          | `statement` (Statement), inverse | built       |
| Agenda                | 75–84              | `agenda` (Agenda)                | built       |
| Text and picture      | 11–20, 23          | `text-image` (Text and image)    | built       |
| Picture with caption  | 8, 41, 42          | `full-image` (Full image)        | built       |
| Two columns           | 32, 35, 36         | `two-columns` (Two columns)      | built       |
| Three or four columns | 30, 37, 38, 40     | `three-columns` (Three columns)  | built       |
| Points grid           | 28, 39             | `six-points` (Six points)        | built       |
| Picture cards         | 24–27, 92, 93, 146 | `image-cards` (Image cards)      | built       |
| Key figures           | 120–128            | `key-figures` (Key figures)      | built       |
| Timeline              | 65, 68, 70, 71     | `timeline` (Timeline)            | built       |
| Roadmap by quarter    | 66, 67, 72         | `roadmap` (Roadmap)              | built       |
| Process               | 61, 64, 69         | `process` (Process)              | built       |
| 2 × 2 matrix          | 62, 63             | `matrix` (Two-by-two matrix)     | built       |
| Venn                  | 58, 59             | `venn` (Venn diagram)            | built       |
| Market size           | 56, 57             | `market-size` (Market size)      | built       |
| Org chart             | 96–98              | `org-chart` (Org chart)          | built       |
| Pricing               | 115–118            | `pricing` (Pricing)              | built       |
| Logo wall             | 111–114            | `logo-wall` (Logo wall)          | built       |
| Quote                 | 99–102             | `quote` (Quote), inverse         | built       |
| Testimonials          | 103–110            | `testimonials` (Testimonials)    | built       |
| Team                  | 87–91, 94, 95      | `team` (Team)                    | built       |
| Contact               | 85, 86             | `contact` (Contact)              | built       |
| Gantt plan            | 73, 74             | `gantt` (Gantt plan)             | built       |
| Chart and text        | 43–51              | `chart-text` (Chart and text)    | placeholder |
| Three charts          | 51                 | `three-charts` (Three charts)    | placeholder |
| Photo collage         | 21, 22, 129        | `collage` (Text and collage)     | placeholder |
| Picture bento         | 130, 131           | `bento` (Picture bento)          | placeholder |
| Picture grid          | 132, 133           | `image-grid` (Picture grid)      | placeholder |
| Feature bento         | 134–136            | `feature-bento` (Feature bento)  | placeholder |
| Phone mockup          | 137–143            | `phone` (Phone mockup)           | placeholder |
| Tablet mockup         | 144, 145           | `tablet` (Tablet mockup)         | placeholder |

## Deferred

Families that need a capability the canvas does not have; each one is a
debt item, not a missing mask. The chart, photo and device families once
listed here are built as placeholder masks above (PO decision, 2026-10-27):
a dashed zone beats no mask. A chart drawn from a data series, a laptop or a
watch frame stay out: nothing on the canvas draws them.

| Family                                             | Reference slides | Why                                                                                      |
| -------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| Data tables (cohorts, headings × rows, two tables) | 52–55            | a table with cells; no table element on the canvas (the database block is page-side)     |
| Feature comparison table                           | 119              | same, a table of check marks                                                             |
| Funnel                                             | 60               | a triangle sliced in bands needs polygon slicing that keeps its proportions when resized |

## Choices

- **Two variants**: `paper` (a light slide that turns dark grey on a dark
  canvas) and `inverse` (section, statement, quote: paper and ink swapped).
  Colours are the base palette's `{ light, dark }` pairs or values readable
  on both papers, never a raw hex: a mask's elements carry no role, so a dark
  canvas paints them as stored (ADR 0039).
- **Type** is `HEADING_SCALE` × 1.5: slide title = H1, headings = H3, body
  = 15 px body, display = the doc title, a key figure = twice the title.
- **Slide number**: written once at insertion (`numberSlide`), the frame's
  rank in presentation order. The frame title is the tile's name.
