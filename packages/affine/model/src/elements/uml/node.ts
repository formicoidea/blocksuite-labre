import { Bound, rotatePoint } from '@labre/global/gfx';
import type { PointTestOptions } from '@labre/std/gfx';
import { field } from '@labre/std/gfx';

import { ShapeElementModel } from '../shape/index.js';
import { umlInLifelineHead, umlLifelineHeadRect } from './lifeline.js';

/**
 * The UML artefacts the pack draws. Each maps onto a native shape, decorated by
 * a glyph where the notation asks for one:
 *
 *  - classifiers  — `class`, `interface` and `enumeration`, the compartmented
 *    rectangle of UML 2.5.1 §11.4, distinguished by the keyword above the name;
 *  - instances    — `object`, the same rectangle with an underlined
 *    `name : Type` (§11.6);
 *  - containers   — `package`, the tabbed folder (§12.2);
 *  - annotations  — `note`, the folded-corner rectangle of Annex A;
 *  - use cases    — `actor`, the stick figure, and `use-case`, the ellipse
 *    (§18.1);
 *  - components   — `component`, the rectangle with the two-tabbed icon in its
 *    corner (§11.6.4), its `port` (§11.3.4), and the two interface glyphs that
 *    hang off it: `provided-interface`, the lollipop, and `required-interface`,
 *    the socket (§10.4.4);
 *  - deployments  — `artifact`, the document icon (§19.3.4), and the three
 *    cubes: `node`, `device` and `execution-environment` (§19.4.4);
 *  - activities   — `action`, the round-cornered rectangle of §15.3.4, the five
 *    control nodes that route its flow (`initial`, `activity-final`,
 *    `flow-final`, `decision`, `fork`), the `object-node` of §15.4.4 and the
 *    three signal and event shapes of §16.3.4 / §16.10.4 (`send-signal`,
 *    `accept-event`, `time-event`);
 *  - state machines — `state` and `final-state` (§14.2.4), and the seven
 *    pseudostates that route transitions: `choice`, `junction`,
 *    `shallow-history`, `deep-history`, `entry-point`, `exit-point` and
 *    `terminate`;
 *  - interactions — `lifeline`, the named head over a dashed spine (§17.3.4),
 *    the `execution` bar that sits on it (§17.2.4) and the `destruction` X that
 *    ends it.
 *
 * ## Compatibility
 *
 * This union is only ever WIDENED — appended to, never reordered — and it is
 * widened with new VALUES of the existing `kind` string field: no new field, no
 * schema change, no migration and no backfill. The same promise `C4NodeKind`
 * and `BpmnNodeKind` make: a diagram drawn today carries one of the values
 * below, loads unchanged on a build that ships more of them, and paints exactly
 * as it always did.
 *
 * What an OLDER build does with a kind it has never heard of is the other half
 * of that promise: the element is a native shape, so it still paints its own
 * box, its own colours and its own words — it simply gets no glyph, because the
 * renderer draws pictures for the kinds it knows and nothing for the rest.
 *
 * The phases that widen it are named in ADR 0017: phase 1 drew the first eight,
 * phase 2 appended the eight structural ones below them and then the nineteen
 * behaviour ones below those, and lifelines come in phase 3.
 */
export type UmlNodeKind =
  // Classifiers.
  | 'class'
  | 'interface'
  | 'enumeration'
  // Instances.
  | 'object'
  // Containers.
  | 'package'
  // Annotations.
  | 'note'
  // Use case artefacts.
  | 'actor'
  | 'use-case'
  // Component artefacts (phase 2).
  | 'component'
  | 'port'
  | 'provided-interface'
  | 'required-interface'
  // Deployment artefacts (phase 2).
  | 'artifact'
  | 'node'
  | 'device'
  | 'execution-environment'
  // Activity artefacts (phase 2): the action of §15.3.4, the control nodes
  // that route the flow between actions, the object node of §15.4.4 and the
  // three signal/event actions of §16.3.4 and §16.10.4.
  | 'action'
  | 'initial'
  | 'activity-final'
  | 'flow-final'
  | 'decision'
  | 'fork'
  | 'object-node'
  | 'send-signal'
  | 'accept-event'
  | 'time-event'
  // State machine artefacts (phase 2): the state of §14.2.4, its final state,
  // and the pseudostates that route transitions between states. `initial` is
  // shared with the activity family above — §14.2.4 and §15.3.4 draw the same
  // filled disc and mean the same thing by it, one per region.
  | 'state'
  | 'final-state'
  | 'choice'
  | 'junction'
  | 'shallow-history'
  | 'deep-history'
  | 'entry-point'
  | 'exit-point'
  | 'terminate'
  // Interaction artefacts (phase 3): the three marks a sequence diagram is
  // drawn out of. A `lifeline` is the participant column of §17.3.4 — a named
  // head over a dashed spine, and the one kind whose picture is bigger than
  // its own box (see the two overrides below). An `execution` is the thin bar
  // of §17.2.4 saying the participant is busy; a `destruction` is the X that
  // ends its life.
  | 'lifeline'
  | 'execution'
  | 'destruction';

/**
 * A UML node. Extends {@link ShapeElementModel} (a native shape) so it inherits
 * ALL shape behaviour — editable stroke width / colours, inner text, native
 * resize, the shape context toolbar — for free. `kind` discriminates the
 * artefacts and drives the RENDERING alone; what a node MEANS is the `role`
 * stamped on it at creation (`gfx/uml/src/roles.ts`).
 *
 * Mirrors {@link C4NodeElementModel}.
 */
export class UmlNodeElementModel extends ShapeElementModel {
  override get type() {
    return 'umlNode';
  }

  /**
   * Connector anchors are restricted to the centre, as they are for a C4 node
   * and for a BPMN flow object: a UML relationship attaches to the node centre
   * and clips at the perimeter, so an association between two classifiers
   * points at the classifiers rather than at whichever of their twelve anchors
   * the hand was nearest.
   *
   * ONE kind says otherwise, and the notation is why. A message in a sequence
   * diagram attaches at a HEIGHT on its lifeline's spine — that height is WHEN
   * it happens, and it is the whole of what a sequence diagram says (§17.4.4).
   * Snapping every message to a 600-unit column's centre would stack the entire
   * conversation on one horizontal line. So a `lifeline` keeps its native
   * perimeter anchors, which lie on the column's left and right edges, 8 units
   * either side of the spine: exactly where every UML tool draws them.
   */
  get centerAnchorOnly() {
    return this.kind !== 'lifeline';
  }

  /**
   * A lifeline's bound includes its HEAD; every other kind's is its box.
   *
   * §17.3.4 draws a lifeline as a named rectangle with a dashed line falling
   * out of its bottom, and the element is the COLUMN the line runs down — 16
   * units wide, so that a connector's native anchors land on the spine rather
   * than 80 units off it. The head is 160 wide, so it hangs 72 units off each
   * side of the element the platform knows about.
   *
   * Everything that measures an element measures `elementBound`: the selection
   * rectangle, the marquee, "fit to frame", the group's own box. Without this
   * override all of them would stop at the column, and a user would see a named
   * box with a selection outline drawn down the middle of it.
   *
   * Nothing here is stored — it is derived from the element's own geometry — so
   * it applies to a lifeline drawn before the override existed as well as
   * after.
   */
  override get elementBound() {
    if (this.kind !== 'lifeline') return super.elementBound;

    const head = umlLifelineHeadRect(this);
    if (!head) return super.elementBound;

    const [x, y, w, h] = this.deserializedXYWH;
    // The union, in the element's own frame: the column plus the head that
    // overflows it. The head is flush with the top and centred, so only the two
    // horizontal edges can move.
    const left = Math.min(0, head.x);
    const right = Math.max(w, head.x + head.w);
    const local: [number, number][] = [
      [x + left, y],
      [x + right, y],
      [x + right, y + h],
      [x + left, y + h],
    ];

    const rotate = this.rotate ?? 0;
    const points = rotate
      ? local.map(
          point =>
            rotatePoint(point, [x + w / 2, y + h / 2], rotate) as [
              number,
              number,
            ]
        )
      : local;

    const xs = points.map(point => point[0]);
    const ys = points.map(point => point[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return new Bound(
      minX,
      minY,
      Math.max(...xs) - minX,
      Math.max(...ys) - minY
    );
  }

  /**
   * A UML node is SOLID whatever its `filled` flag says.
   *
   * `rect.includesPoint` (and `ellipse`'s) skips the interior test for an
   * unfilled shape and falls back to the stroke plus the tight bounding box of
   * the text run — the behaviour that makes a hollow group let clicks through
   * to the work it encloses. Several UML kinds are created unfilled and
   * unstroked on purpose: a `package` is a tabbed folder, a `note` a rectangle
   * with a folded corner, an `actor` a stick figure, none of which a native
   * rect can be, so the GLYPH paints the body and the native shape paints
   * nothing at all.
   *
   * The consequence, the one the PO reported against C4 on 27/08/2026, is that
   * such nodes cannot be double-clicked into their own text editor: the body a
   * user can plainly see is not a hit target, and only the border and the
   * handful of characters of the label are. Pointer events reach an element
   * view through this method (`GfxViewEventHandler`), so selecting, hovering,
   * dragging and `dblclick` are all affected — the last one visibly.
   *
   * Forcing `ignoreTransparent: false` says the one thing that is true of every
   * UML artefact: it is a BOX, and its whole area belongs to it. Nothing here
   * is stored — the override changes hit testing, never the document — so it
   * applies to nodes drawn before it existed as well as after.
   */
  override includesPoint(x: number, y: number, options: PointTestOptions) {
    if (
      super.includesPoint(x, y, {
        ...options,
        ignoreTransparent: false,
      })
    ) {
      return true;
    }

    // …plus the one carve-out the pack keeps: a lifeline's HEAD, which is the
    // part of it a user actually aims at (§17.3.4). The column the element is
    // is 16 units wide — a hair at any realistic zoom — and the named box over
    // its top is 160. Without this the head would be unclickable, which is the
    // same failure the diagram frame's heading band would have had.
    return this.kind === 'lifeline' && umlInLifelineHead(this, x, y);
  }

  /**
   * The one field a UML node carries, and the whole of its schema.
   *
   * The labels a classifier shows — its name, its attribute compartment, its
   * operation compartment — are deliberately NOT fields here. They are canvas
   * TEXT elements, grouped with the shape, and they are edited in place exactly
   * like any other words on the canvas (R16, and the PO recette of 28/08/2026
   * that settled it for C4's type line and description). A field would have
   * been a second place to write the same sentence, reachable only through a
   * form, and the form is the mechanism the recette rejected: an architect
   * writes on the picture.
   *
   * What that buys the document format is that this model stays exactly what it
   * is — `kind`, on a native shape — however many compartments the component
   * grows.
   */
  @field('class' as UmlNodeKind)
  accessor kind: UmlNodeKind = 'class';
}
