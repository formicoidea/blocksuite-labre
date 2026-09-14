import type { PointTestOptions } from '@labre/std/gfx';
import { field } from '@labre/std/gfx';

import { ShapeElementModel } from '../shape/index.js';

/**
 * The UML artefacts the pack draws — phase 1, the four structural diagrams
 * (class, package, object, use case). Each maps onto a native shape, decorated
 * by a glyph where the notation asks for one:
 *
 *  - classifiers  — `class`, `interface` and `enumeration`, the compartmented
 *    rectangle of UML 2.5.1 §11.4, distinguished by the keyword above the name;
 *  - instances    — `object`, the same rectangle with an underlined
 *    `name : Type` (§11.6);
 *  - containers   — `package`, the tabbed folder (§12.2);
 *  - annotations  — `note`, the folded-corner rectangle of Annex A;
 *  - use cases    — `actor`, the stick figure, and `use-case`, the ellipse
 *    (§18.1).
 *
 * ## Compatibility
 *
 * This union is only ever WIDENED, and it is widened with new VALUES of the
 * existing `kind` string field — no new field, no schema change, no migration
 * and no backfill. The same promise `C4NodeKind` and `BpmnNodeKind` make: a
 * diagram drawn today carries one of the eight values below, loads unchanged on
 * a build that ships more of them, and paints exactly as it always did.
 *
 * The phases that widen it are named in ADR 0017: components and deployment
 * artefacts in phase 2, lifelines in phase 3.
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
  | 'use-case';

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
