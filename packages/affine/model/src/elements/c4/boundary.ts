import type { SerializedXYWH } from '@labre/global/gfx';
import { field } from '@labre/std/gfx';

import type { FrameworkBackgroundProps } from '../framework-background/index.js';
import { FrameworkBackgroundElementModel } from '../framework-background/index.js';

/**
 * Which level a boundary encloses. C4 draws the two identically — a dashed
 * rectangle round a group of elements — and the difference is entirely in what
 * the label says, which is why this is one element type with a variant rather
 * than two.
 */
export type C4BoundaryVariant = 'system' | 'container';

export type C4BoundaryProps = FrameworkBackgroundProps & {
  /** The boundary name, written bottom-left — edited inline on dblclick. */
  name?: string;
  /** Which level this boundary encloses. Absent behaves as `'system'`. */
  variant?: C4BoundaryVariant;
};

/**
 * A C4 boundary: the dashed rectangle drawn AROUND a group of elements to say
 * "all of this is one system" (or one container). A framework background, so
 * nodes are dropped on it and connectors never snap to it — but a transparent
 * one, unlike every other background in the library: a boundary is drawn over
 * the board it sits on, and an opaque card would hide the diagram it encloses.
 *
 * What it LOOKS like is declared, not coded: see `C4_BOUNDARY_BACKGROUND` in
 * `@labre/affine-gfx-c4`.
 */
export class C4BoundaryElementModel extends FrameworkBackgroundElementModel<C4BoundaryProps> {
  get type() {
    return 'c4Boundary';
  }

  @field('Boundary')
  accessor name: string = 'Boundary';

  @field(true)
  accessor resizeEnabled: boolean = true;

  @field(0)
  accessor rotate: number = 0;

  @field()
  accessor xywh: SerializedXYWH = '[0,0,520,360]';

  /**
   * The level enclosed — the only OPTIONAL field of this element, and optional
   * on purpose.
   *
   * `@field()`'s `init` writes nothing for an `undefined` default, so a boundary
   * that never states its level stays byte-identical to one created before this
   * value existed: no schema version bump, no migration, and every document
   * already on disk opens and paints exactly as it did. The same call
   * `BpmnPoolElementModel.lanes` makes, for the same reason.
   *
   * Absent reads as `'system'` everywhere — the outermost boundary, which is the
   * one a reader draws first and the one the default wording names.
   */
  @field()
  accessor variant: C4BoundaryVariant | undefined = undefined;
}
