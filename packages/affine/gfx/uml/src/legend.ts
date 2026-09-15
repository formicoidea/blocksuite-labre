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
 * ## `exact` on the association and on the node, and nowhere else
 *
 * `uml:aggregation` and `uml:composition` specialise `uml:association`
 * (`roles.ts`), so an inclusive entry on the parent would put an "Association"
 * row — a plain undecorated line — on a board carrying nothing but diamonds. The
 * row would name a line that is nowhere on the diagram. `exact` makes the base
 * and its two specialisations three separate statements, each listed when it is
 * the thing the author actually drew.
 *
 * `uml:node` is the second and last, for the same sentence one clause later:
 * §19.4.4 makes a Device and an ExecutionEnvironment kinds of Node, and a
 * deployment sheet of keyworded cubes would otherwise carry a bare "Node" row
 * naming a box nobody drew.
 *
 * The other three chains need no such care, because none of their parents gets a
 * row at all: `uml:classifier`, `uml:control-node`, `uml:pseudostate` and
 * `uml:message` are ancestors nothing is ever drawn as, and a "Classifier" or a
 * "Message" row would name a shape that exists only in the vocabulary.
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
        // ── The STRUCTURAL artefacts (phase 2, §11.6.4, §11.3.4, §10.4.4) ──
        //
        // A component and an artifact are the divided rectangle again, so they
        // are squares. The two interface MARKS are the second place this
        // vocabulary's silhouettes are real: §10.4.4 draws a provided interface
        // as a BALL, which is a dot, and a required one as the socket that
        // receives it — an open curve with nothing inside it, which is a line
        // for the reason the destruction's row is one.
        {
          role: UML_ROLE.component,
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE.component),
          },
        },
        {
          role: UML_ROLE.port,
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE.port),
          },
        },
        {
          role: UML_ROLE['provided-interface'],
          row: {
            swatch: 'dot',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE['provided-interface']),
          },
        },
        {
          role: UML_ROLE['required-interface'],
          row: {
            swatch: 'line',
            color: UML_INK,
            label: roleLabel(UML_ROLES, UML_ROLE['required-interface']),
          },
        },
        // ── The DEPLOYMENT targets (phase 2, §19.3.4, §19.4.4) ─────────────
        //
        // `exact` on the NODE, and the association's argument one clause later:
        // a device and an execution environment specialise `uml:node`
        // (`roles.ts`), so an inclusive entry would put a plain "Node" row on a
        // board holding nothing but keyworded cubes — a row naming a box that is
        // nowhere on the sheet. Three separate statements, each listed when it
        // is the cube the author actually drew.
        {
          role: UML_ROLE.artifact,
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE.artifact),
          },
        },
        {
          role: UML_ROLE.node,
          exact: true,
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE.node),
          },
        },
        {
          role: UML_ROLE.device,
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE.device),
          },
        },
        {
          role: UML_ROLE['execution-environment'],
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE['execution-environment']),
          },
        },
        // ── The ACTIVITY vocabulary (phase 2, §15.3.4, §15.4.4, §16.3.4) ───
        //
        // Where the swatches finally carry weight: §15.3.4 draws the routing
        // marks as DISCS and BARS, and a reader looking up "what is the black
        // dot" is looking for a round row. The bar is a line for the
        // destruction's reason — a fork has no body, and a filled square would
        // draw a box the notation does not have.
        //
        // `uml:control-node` gets no row, exactly as `uml:classifier` gets
        // none: it is a parent nothing is ever drawn as, and a "Control node"
        // row would name a shape that is nowhere on the sheet.
        {
          role: UML_ROLE.action,
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE.action),
          },
        },
        {
          role: UML_ROLE.initial,
          row: {
            swatch: 'dot',
            color: UML_INK,
            label: roleLabel(UML_ROLES, UML_ROLE.initial),
          },
        },
        {
          role: UML_ROLE['activity-final'],
          row: {
            swatch: 'dot',
            color: UML_INK,
            label: roleLabel(UML_ROLES, UML_ROLE['activity-final']),
          },
        },
        {
          role: UML_ROLE['flow-final'],
          row: {
            // Hollow, unlike the two above: §15.3.4's flow final is a circle
            // with a cross in it, and the whole point of the mark is that it is
            // NOT the filled bullseye that ends the activity.
            swatch: 'dot',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE['flow-final']),
          },
        },
        {
          role: UML_ROLE.decision,
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE.decision),
          },
        },
        {
          role: UML_ROLE.fork,
          row: {
            swatch: 'line',
            color: UML_INK,
            label: roleLabel(UML_ROLES, UML_ROLE.fork),
          },
        },
        {
          role: UML_ROLE['object-node'],
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE['object-node']),
          },
        },
        {
          role: UML_ROLE['send-signal'],
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE['send-signal']),
          },
        },
        {
          role: UML_ROLE['accept-event'],
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE['accept-event']),
          },
        },
        {
          role: UML_ROLE['time-event'],
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE['time-event']),
          },
        },
        // ── The STATE MACHINE vocabulary (phase 2, §14.2.4) ────────────────
        //
        // `uml:pseudostate` gets no row, for `uml:control-node`'s reason. The
        // five that do are round because §14.2.4 draws them round, and the
        // terminate is a line because it is two strokes and no body — the
        // destruction's row, one clause earlier.
        {
          role: UML_ROLE.state,
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE.state),
          },
        },
        {
          role: UML_ROLE['final-state'],
          row: {
            swatch: 'dot',
            color: UML_INK,
            label: roleLabel(UML_ROLES, UML_ROLE['final-state']),
          },
        },
        {
          role: UML_ROLE.choice,
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE.choice),
          },
        },
        {
          role: UML_ROLE.junction,
          row: {
            swatch: 'dot',
            color: UML_INK,
            label: roleLabel(UML_ROLES, UML_ROLE.junction),
          },
        },
        {
          role: UML_ROLE['shallow-history'],
          row: {
            swatch: 'dot',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE['shallow-history']),
          },
        },
        {
          role: UML_ROLE['deep-history'],
          row: {
            swatch: 'dot',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE['deep-history']),
          },
        },
        {
          role: UML_ROLE['entry-point'],
          row: {
            swatch: 'dot',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE['entry-point']),
          },
        },
        {
          role: UML_ROLE['exit-point'],
          row: {
            swatch: 'dot',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE['exit-point']),
          },
        },
        {
          role: UML_ROLE.terminate,
          row: {
            swatch: 'line',
            color: UML_INK,
            label: roleLabel(UML_ROLES, UML_ROLE.terminate),
          },
        },
        // The interaction artefacts (phase 3). A sequence diagram is drawn out
        // of three marks a reader who knows class diagrams has never seen, so
        // they are the rows the legend earns its place with.
        {
          role: UML_ROLE.lifeline,
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE.lifeline),
          },
        },
        {
          role: UML_ROLE.execution,
          row: {
            swatch: 'square',
            color: UML_CARD,
            label: roleLabel(UML_ROLES, UML_ROLE.execution),
          },
        },
        {
          role: UML_ROLE.destruction,
          row: {
            // A line: §17.2.4's destruction is two strokes and no body, so a
            // filled swatch would draw a box the notation does not have — the
            // call the subject's row already makes, for the same reason.
            swatch: 'line',
            color: UML_INK,
            label: roleLabel(UML_ROLES, UML_ROLE.destruction),
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
        // §15.6.4's swimlane and §14.2.4's composite state — phase 2's two
        // frames, and the same call the subject makes for the same reason: a
        // band and a box drawn ROUND part of the drawing have no body, so a
        // filled swatch would paint the one thing neither of them does.
        {
          role: UML_ROLE.partition,
          row: {
            swatch: 'line',
            color: UML_FRAME_INK,
            label: roleLabel(UML_ROLES, UML_ROLE.partition),
          },
        },
        {
          role: UML_ROLE.region,
          row: {
            swatch: 'line',
            color: UML_FRAME_INK,
            label: roleLabel(UML_ROLES, UML_ROLE.region),
          },
        },
        {
          // §17.6.4's combined fragment, and the same call as the subject: a
          // transparent frame has no body to put in a swatch.
          role: UML_ROLE.fragment,
          row: {
            swatch: 'line',
            color: UML_FRAME_INK,
            label: roleLabel(UML_ROLES, UML_ROLE.fragment),
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
        // ── The DEPLOYMENT relationships (phase 2, §19.2.4, §19.3.4) ───────
        //
        // Dashed exactly where the notation dashes: a `«deploy»` and a
        // `«manifest»` are keyworded DEPENDENCIES and are drawn with the
        // dependency's broken line, while §19.4.4's communication path is the
        // one undecorated solid line in the deployment vocabulary.
        {
          role: UML_ROLE.deploy,
          row: {
            swatch: 'line',
            color: UML_INK,
            dashed: true,
            label: roleLabel(UML_ROLES, UML_ROLE.deploy),
          },
        },
        {
          role: UML_ROLE.manifest,
          row: {
            swatch: 'line',
            color: UML_INK,
            dashed: true,
            label: roleLabel(UML_ROLES, UML_ROLE.manifest),
          },
        },
        {
          role: UML_ROLE['communication-path'],
          row: {
            swatch: 'line',
            color: UML_INK,
            label: roleLabel(UML_ROLES, UML_ROLE['communication-path']),
          },
        },
        // ── The BEHAVIOUR relationships (phase 2, §15.2.4, §14.2.4.8) ──────
        //
        // All three solid, and all three are a solid line with an open
        // arrowhead — which is precisely why these rows exist as WORDS rather
        // than as pictures: a control flow, an object flow and a transition are
        // drawn identically, and the only thing that tells them apart on a
        // finished sheet is what they run between and which sheet it is.
        {
          role: UML_ROLE['control-flow'],
          row: {
            swatch: 'line',
            color: UML_INK,
            label: roleLabel(UML_ROLES, UML_ROLE['control-flow']),
          },
        },
        {
          role: UML_ROLE['object-flow'],
          row: {
            swatch: 'line',
            color: UML_INK,
            label: roleLabel(UML_ROLES, UML_ROLE['object-flow']),
          },
        },
        {
          role: UML_ROLE.transition,
          row: {
            swatch: 'line',
            color: UML_INK,
            label: roleLabel(UML_ROLES, UML_ROLE.transition),
          },
        },
        // The five MESSAGES (phase 3, §17.4.4). The parent `uml:message` gets
        // no row: it is an ancestor nothing is ever drawn as, exactly like
        // `uml:classifier`, and a "Message" row would name a line that is
        // nowhere on the diagram. The five children are each listed when they
        // are the thing the author actually drew.
        //
        // This is the one clause of the specification whose lines differ BY THE
        // DRAWING, so the swatches here carry real information for once: the
        // two dashed rows are the reply and the create, and they are dashed
        // because §17.4.4 dashes them.
        {
          role: UML_ROLE['message-sync'],
          row: {
            swatch: 'line',
            color: UML_INK,
            label: roleLabel(UML_ROLES, UML_ROLE['message-sync']),
          },
        },
        {
          role: UML_ROLE['message-async'],
          row: {
            swatch: 'line',
            color: UML_INK,
            label: roleLabel(UML_ROLES, UML_ROLE['message-async']),
          },
        },
        {
          role: UML_ROLE['message-reply'],
          row: {
            swatch: 'line',
            color: UML_INK,
            dashed: true,
            label: roleLabel(UML_ROLES, UML_ROLE['message-reply']),
          },
        },
        {
          role: UML_ROLE['message-create'],
          row: {
            swatch: 'line',
            color: UML_INK,
            dashed: true,
            label: roleLabel(UML_ROLES, UML_ROLE['message-create']),
          },
        },
        {
          role: UML_ROLE['message-delete'],
          row: {
            swatch: 'line',
            color: UML_INK,
            label: roleLabel(UML_ROLES, UML_ROLE['message-delete']),
          },
        },
      ],
    },
  ],
};
