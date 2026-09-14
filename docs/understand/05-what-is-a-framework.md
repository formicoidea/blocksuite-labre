# What a business framework is

**A framework is a board, artefacts drawn on it, and a set of declarations
that the editor turns into tooling.**

Frameworks today: Wardley maps, EDGY, BPMN, C4, Cynefin/Estuarine, DDD event
storming, DDD core domain chart, DDD context map, UML. All live under
`packages/affine/gfx/<id>`. Wardley is the reference implementation.

## The board

Every framework has a **background** element (the code says background; the
product says board): the Wardley map with its axes, the BPMN pool, the C4
board with its title band, the Cynefin frame. It extends
`FrameworkBackgroundElementModel` in `packages/affine/model`, which gives it
the shared behaviour:

- it is picked by its **border** (a 10 screen-pixel band, constant at every
  zoom), plus its title bands. Clicking inside it selects what is on it.
- it is a **floor, never a lid**: anything drawn over it is kept above it.
  Boards can stack; each stays under its own artefacts.
- it is never a connector endpoint and never frame content.
- it is not a container. Membership ("this node is on this map") is computed
  from geometry at read time: whole containment for the board, centre point
  for inner regions such as zones or lanes.

One framework has one board. When a notation draws several kinds of diagram on
the same sheet under the same frame, the kind is a **field of the board** rather
than a second framework — see R34 in
[../add-a-framework/02-framework-rules.md](../add-a-framework/02-framework-rules.md).

## The artefacts

A Wardley component, a BPMN task, a C4 container. They are **native shapes
with a discriminator**: `WardleyNodeElementModel extends ShapeElementModel`
with a `kind` field. So they inherit move, resize, colour, stroke, the
connector anchor and the shape toolbar for free; only the glyph is drawn by
the framework's renderer.

A compound artefact (a pipeline, a market, a C4 node with three text tiers)
is a **group** of base elements: shape plus free text plus connectors. The
group is the unit of identity: morphing one artefact into another operates
on the group.

Labels are **separate free-text elements grouped with the shape**, never text
stored on the shape. They carry their own role, so rules can talk about where
a label lands.

## The declarations

Everything the editor knows about a framework is data exported by the
package:

| Declaration        | File                                       | What it feeds                                                                                                                |
| ------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| roles              | `roles.ts`                                 | the semantic vocabulary (`wardley:component`, `wardley:dependency`), with a `kind` (node, edge, text) and an optional parent |
| natures            | `natures.ts`                               | level-3 qualifications of a role (`wardley:nature = data`)                                                                   |
| commands           | `commands.ts`                              | senior sub-menu, catalogue, palette, shortcuts, AI agent, telemetry                                                          |
| presets            | `presets.ts`                               | birth props of each artefact (size, shape, font), shared by creation and morph                                               |
| background         | `background.ts`                            | the board's plot: margins, axes, bands                                                                                       |
| rules and profiles | `rules.ts`, `profiles.ts`                  | validation findings and their severities                                                                                     |
| nudges             | `nudges.ts`                                | a quality checklist the engine cannot judge                                                                                  |
| reading            | `reading.ts`                               | what the tool proposes about a component the user clicks                                                                     |
| interchange        | `interchange.ts`, `export.ts`, `import.ts` | native format import/export, as pure functions                                                                               |
| templates          | `templates/`                               | the Templates panel category: worked examples plus one derived entry per artefact command                                    |
| legend             | `legend.ts`                                | the auto-generated legend group                                                                                              |
| translations       | `translations.ts`                          | the `com.labre.*` keys derived from the declarations above                                                                   |

The full rulebook is in
[add-a-framework/02-framework-rules.md](../add-a-framework/02-framework-rules.md).

## Validation never blocks

Rules produce findings with a severity: `warning` (shown) or `audit` (only
in the audit panel). The engine also declares `blocking-overridable`, and
nothing uses it. The default profile of every framework is the most
permissive one (Wardley calls it `sketch`), and choosing the default writes
nothing on the element. A framework may ship no rules at all: Cynefin does,
by decision (ADR 0013).

Rules run only when a board of the framework exists on the surface. A Wardley
node on a blank canvas is a sketch, not an error. A node beside a map is
judged and attributed to the nearest map: that is what the "element outside
its board" finding is for.

## Where the tooling shows up

```
 whiteboard toolbar
 ┌──────────────────────────────────────────────────────────────┐
 │ … [Wardley] [EDGY] [BPMN] [C4] [Cynefin] [DDD…] [UML]        │  senior row (order = FRAMEWORK_DESCRIPTORS)
 └──────────┬───────────────────────────────────────────────────┘
            ▼ click
 ┌──────────────────────────────┐
 │ sub-menu: up to 13 artefacts │  ranked by recency and frequency,
 │ + "More artefacts…"          │  displayed in authored order
 └──────────────────────────────┘
            ▼
 ┌──────────────────────────────┐
 │ catalogue: every command     │  the total surface of the framework
 └──────────────────────────────┘
```

Import of a native format sits in the sub-menu (a board comes _from_ a
file). Export sits on the selected board's contextual toolbar (you export a
board you already have). The legend button is on that contextual toolbar too.

Next: [06-glossary.md](06-glossary.md).
