import type { PointTestOptions } from '@labre/std/gfx';
import { field } from '@labre/std/gfx';

import { ShapeElementModel } from '../shape/index.js';

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
 *    `terminate`.
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
  | 'terminate';

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
   */
  get centerAnchorOnly() {
    return true;
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
    return super.includesPoint(x, y, {
      ...options,
      ignoreTransparent: false,
    });
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
