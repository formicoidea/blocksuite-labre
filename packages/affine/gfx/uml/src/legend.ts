import { type AutoLegendSpec, roleLabel } from '@labre/affine-gfx-ddd-shared';

import { UML_CARD, UML_FRAME_INK, UML_INK } from './consts.js';
import { UML_ROLE, UML_ROLES } from './roles.js';

/**
 * What the UML diagram frame's automatic legend can say — a TABLE, and nothing
 * else: the scan, the placement and the box are `createAutoLegend`'s job, shared
 * with the C4 board and the three DDD boards.
 *
 * Every row's WORDING is derived from the role vocabulary's own `labelFallback`
 * ({@link roleLabel}) rather than restated here, so renaming a role renames its
 * legend row — which is what keeps a legend a description of the board rather
 * than a second opinion about it.
 *
 * ## A monochrome legend, and what carries the meaning instead
 *
 * The other packs' legends are colour keys: a C4 row is a blue square, an EDGY
 * row a facet's hue. UML defines no palette — every figure in the specification
 * is black on white — so every swatch below is the same card white with the same
 * ink round it, and the WORDS are the key. That is the honest legend for this
 * notation: a reader of a class diagram tells a class from an interface by the
 * keyword written in the box, never by its colour.
 *
 * The one distinction the swatch vocabulary CAN carry is silhouette, and it is
 * used where it is real: a use case is a `dot` because §18.1.4 draws it as an
 * ellipse, everything else is a `square` because §11.4.4 and §12.2.4 draw
 * rectangles. Relations are `line` swatches, dashed exactly where the notation
 * dashes them.
 *
 * ## `exact` on the association, and only there
 *
 * `uml:aggregation` and `uml:composition` specialise `uml:association`
 * (`roles.ts`), so an inclusive entry on the parent would put an "Association"
 * row — a plain undecorated line — on a board carrying nothing but diamonds. The
 * row would name a line that is nowhere on the diagram. `exact` makes the base
 * and its two specialisations three separate statements, each listed when it is
 * the thing the author actually drew.
 *
 * The classifier chain needs no such care, because `uml:classifier` gets no row:
 * it is an ancestor nothing is ever drawn as, and a "Classifier" row would name
 * a box that exists only in the vocabulary.
 *
 * ## The frame gets no row either
 *
 * `uml:diagram` is the sheet the legend is drawn ON. Listing it would be listing
 * the paper — the same call the C4 board's legend makes about itself.
 */
export const UML_AUTO_LEGEND: AutoLegendSpec = {
  title: 'Legend',
  width: 290,
  roles: UML_ROLES,
  sections: [
    {
      title: 'Elements',
      entries: [
        {
          role: UML_ROLE.class,
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE.class),
          },
        },
        {
          role: UML_ROLE.interface,
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE.interface),
          },
        },
        {
          role: UML_ROLE.enumeration,
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE.enumeration),
          },
        },
        {
          role: UML_ROLE.object,
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE.object),
          },
        },
        {
          role: UML_ROLE.package,
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE.package),
          },
        },
        {
          role: UML_ROLE.note,
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE.note),
          },
        },
        {
          role: UML_ROLE.actor,
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE.actor),
          },
        },
        {
          role: UML_ROLE['use-case'],
          row: {
            // The one silhouette the swatch vocabulary can tell: §18.1.4 draws
            // a use case as an ellipse and nothing else on this board is one.
            swatch: 'dot',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE['use-case']),
          },
        },
      ],
    },
    {
      title: 'Frames',
      entries: [
        {
          role: UML_ROLE.subject,
          row: {
            // A line, not a square: a subject has no body — it is the rectangle
            // itself, and a filled swatch would draw the one thing this
            // background deliberately does not paint.
            swatch: 'line',
            color: UML_FRAME_INK,
            label: roleLabel(UML_ROLES, UML_ROLE.subject),
          },
        },
      ],
    },
    {
      title: 'Relations',
      entries: [
        {
          role: UML_ROLE.association,
          // See the note above: a board of diamonds must not claim a plain line.
          exact: true,
          row: {
            swatch: 'line',
            color: UML_INK,
            label: roleLabel(UML_ROLES, UML_ROLE.association),
          },
        },
        {
          role: UML_ROLE.aggregation,
          row: {
            swatch: 'line',
            color: UML_INK,
            label: roleLabel(UML_ROLES, UML_ROLE.aggregation),
          },
        },
        {
          role: UML_ROLE.composition,
          row: {
            swatch: 'line',
            color: UML_INK,
            label: roleLabel(UML_ROLES, UML_ROLE.composition),
          },
        },
        {
          role: UML_ROLE.generalization,
          row: {
            swatch: 'line',
            color: UML_INK,
            label: roleLabel(UML_ROLES, UML_ROLE.generalization),
          },
        },
        // The dashed half of the notation, marked as such: a legend that showed
        // a solid bar for a realization would be telling a small lie about the
        // one thing that tells it from a generalization.
        {
          role: UML_ROLE.realization,
          row: {
            swatch: 'line',
            color: UML_INK,
            dashed: true,
            label: roleLabel(UML_ROLES, UML_ROLE.realization),
          },
        },
        {
          role: UML_ROLE.dependency,
          row: {
            swatch: 'line',
            color: UML_INK,
            dashed: true,
            label: roleLabel(UML_ROLES, UML_ROLE.dependency),
          },
        },
        {
          role: UML_ROLE.anchor,
          row: {
            swatch: 'line',
            color: UML_INK,
            dashed: true,
            label: roleLabel(UML_ROLES, UML_ROLE.anchor),
          },
        },
        {
          role: UML_ROLE.include,
          row: {
            swatch: 'line',
            color: UML_INK,
            dashed: true,
            label: roleLabel(UML_ROLES, UML_ROLE.include),
          },
        },
        {
          role: UML_ROLE.extend,
          row: {
            swatch: 'line',
            color: UML_INK,
            dashed: true,
            label: roleLabel(UML_ROLES, UML_ROLE.extend),
          },
        },
      ],
    },
  ],
};
