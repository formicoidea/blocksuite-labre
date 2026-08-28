import type { PointTestOptions } from '@labre/std/gfx';
import { field } from '@labre/std/gfx';

import { ShapeElementModel } from '../shape/index.js';

/**
 * The C4 artefacts the pack draws — the four levels of the model, plus the
 * container flavours the official stencil gives a silhouette of their own:
 *
 *  - people        — `person` and `person-ext`, a head over a rounded body;
 *  - systems       — `system` and `system-ext`, a plain rounded rectangle;
 *  - containers    — `container`, plus `database` (a cylinder), `mobile` (a
 *    phone bezel down the leading edge) and `browser` (a chrome band across the
 *    top). All four are CONTAINERS: what differs is the picture, never the
 *    level;
 *  - components    — `component`, the innermost level C4 draws.
 *
 * ## Why "external" is a KIND and not a flag
 *
 * `person-ext` and `system-ext` are separate values rather than an `external`
 * boolean, mirroring {@link BpmnNodeKind}'s message and timer starts: the C4
 * stencil greys an external element out entirely — fill, border and label — so
 * externality is a different picture, not a modifier on one. One discriminant
 * keeps the renderer's switch total and the size / palette tables keyed the same
 * way; a second, orthogonal flag would multiply both by two and let a
 * combination exist that the notation has no drawing for.
 *
 * ## Compatibility
 *
 * This union is only ever WIDENED, and it is widened with new VALUES of the
 * existing `kind` string field — no new field, no schema change, no migration
 * and no backfill. Same promise `wardley` and `bpmn` already make.
 */
export type C4NodeKind =
  // People.
  | 'person'
  | 'person-ext'
  // Software systems.
  | 'system'
  | 'system-ext'
  // Containers — the level, and its three drawn flavours.
  | 'container'
  | 'database'
  | 'mobile'
  | 'browser'
  // Components.
  | 'component';

/**
 * A C4 node. Extends {@link ShapeElementModel} (a native shape) so it inherits
 * ALL shape behaviour — editable stroke width / colours, inner text, native
 * resize, the shape context toolbar — for free. `kind` discriminates the
 * artefacts and drives the RENDERING alone; what a node MEANS is the `role`
 * stamped on it at creation (`gfx/c4/src/roles.ts`).
 *
 * Mirrors {@link BpmnNodeElementModel}.
 */
export class C4NodeElementModel extends ShapeElementModel {
  override get type() {
    return 'c4Node';
  }

  /**
   * Connector anchors are restricted to the centre, as they are for a BPMN flow
   * object: a C4 relationship attaches to the node centre and clips at the
   * perimeter, so an arrow between two boxes points at the boxes rather than at
   * whichever of their twelve anchors the hand was nearest.
   */
  get centerAnchorOnly() {
    return true;
  }

  /**
   * A C4 node is SOLID whatever its `filled` flag says.
   *
   * `rect.includesPoint` (and `ellipse`'s, and `diamond`'s) skips the interior
   * test for an unfilled shape and falls back to the stroke plus the tight
   * bounding box of the text run — the behaviour that makes a hollow group let
   * clicks through to the work it encloses. Three of the nine C4 kinds are
   * created unfilled and unstroked on purpose (`person`, `person-ext`,
   * `database`, and the two decorated containers): their silhouette is a head
   * over a body, a cylinder, a phone or a browser window, none of which a native
   * rect can be, so the GLYPH paints the body and the native shape paints
   * nothing at all.
   *
   * The consequence, reported by the PO on 27/08/2026, is that those nodes could
   * not be double-clicked into their own text editor: the body a user can
   * plainly see was not a hit target, and only the border and the handful of
   * characters of the label were. Pointer events reach an element view through
   * this method (`GfxViewEventHandler`), so selecting, hovering, dragging and
   * `dblclick` were all affected — the last one visibly.
   *
   * Forcing `ignoreTransparent: false` says the one thing that is true of every
   * C4 artefact and of no BPMN group: it is a BOX, and its whole area belongs to
   * it. Nothing here is stored — the override changes hit testing, never the
   * document — so it applies to nodes drawn before it existed as well as after.
   *
   * The same latent gap exists for BPMN's `dataObject` / `dataStore`; it is not
   * fixed there because a BPMN artifact's own answer may well be different (its
   * `hollow` kinds want the click-through), and guessing on another pack's
   * behalf is how a fix becomes a regression.
   */
  override includesPoint(x: number, y: number, options: PointTestOptions) {
    return super.includesPoint(x, y, {
      ...options,
      ignoreTransparent: false,
    });
  }

  @field('system' as C4NodeKind)
  accessor kind: C4NodeKind = 'system';

  /**
   * The technology this element is built with — the `technology` half of C4's
   * `[Container: technology]` type line, and mermaid's `techn` argument.
   *
   * OPTIONAL, and `undefined` by default: `@field()`'s `init` writes nothing for
   * an `undefined` default, so a node that never states a technology stays
   * byte-identical to one created before this field existed. No schema version
   * bump, no migration, every document already on disk opens and paints exactly
   * as it did. The same call {@link C4BoundaryElementModel.variant} makes.
   *
   * Never the TYPE itself: what kind of thing this is comes from `kind` and is
   * derived (`c4TypeLine`), so the two can never disagree.
   */
  @field()
  accessor technology: string | undefined = undefined;

  /**
   * The sentence under the type line — the third tier of the official notation,
   * and the one that says what the element is FOR.
   *
   * Optional on exactly the same terms as {@link technology}.
   */
  @field()
  accessor description: string | undefined = undefined;
}
