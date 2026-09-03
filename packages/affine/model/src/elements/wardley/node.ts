import { field } from '@labre/std/gfx';

import { ShapeElementModel } from '../shape/index.js';

export type WardleyNodeKind =
  | 'component'
  | 'anchor'
  | 'pipeline'
  | 'handle'
  | 'market'
  | 'ecosystem'
  | 'method'
  | 'porter'
  | 'accelerator'
  | 'decelerator'
  | 'area';

/**
 * A Wardley map node. Extends {@link ShapeElementModel} (a native ellipse) so it
 * inherits ALL shape behaviour — editable stroke width / colors, native resize,
 * center connector anchor, the shape context toolbar — for free. `kind`
 * discriminates the plain `component`, the `anchor` (which the renderer
 * decorates with an inscribed person glyph), the two pieces of a pipeline (the
 * `pipeline` body + its square `handle`), the `market` outer circle, the
 * `ecosystem` grey backing disk, the `porter` circle — a Porter's-forces
 * glyph, which is the one kind that is NOT a link in the value chain: it marks
 * an external competition force acting on the map — and the `accelerator` /
 * `decelerator` arrows, which are not links in the chain either: they annotate
 * the CLIMATE, saying that something is speeding evolution up or slowing it
 * down. Those two are the first kinds drawn as a native POLYGON rather than an
 * ellipse or a rect — and the `area` is the third: a translucent ZONE of the
 * map, drawn as a rect or as a polygon over the components it groups, and the
 * only kind whose two shapes are the same kind (the `shapeType` says which).
 * Composite nodes (pipeline / market / ecosystem / porter / accelerator /
 * decelerator) are built by grouping several of these + native connectors + a
 * text label. The text label is a SEPARATE native text element grouped with the
 * node, not stored here — the `porter` and the `area` being the exceptions that
 * prove it, since the porter's one letter and the area's name are the shape's
 * own inner text.
 *
 * `kind` is ADDITIVE by construction: a value is only ever appended, so a
 * document written before a value was appended carries none of it and opens
 * unchanged. `area` is the most recent, and needs no migration.
 */
export class WardleyNodeElementModel extends ShapeElementModel {
  override get type() {
    return 'wardleyNode';
  }

  /**
   * Connector anchors are restricted to the center for Wardley nodes (read by
   * the connector manager / tool). Links therefore always attach to the node
   * center and clip at the perimeter — the clean Wardley behaviour.
   */
  get centerAnchorOnly() {
    return true;
  }

  /**
   * The pipeline body offers NO connector anchors (a pipeline is connected only
   * through its handle). All other kinds — including the ecosystem (a single
   * glyph circle) and the market outer circle — keep the native connectable
   * behaviour with center-only anchoring via {@link centerAnchorOnly}.
   */
  override get connectable() {
    return this.kind !== 'pipeline';
  }

  @field('component' as WardleyNodeKind)
  accessor kind: WardleyNodeKind = 'component';
}
