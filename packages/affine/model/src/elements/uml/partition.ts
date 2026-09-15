import type { SerializedXYWH } from '@labre/global/gfx';
import type { PointTestOptions } from '@labre/std/gfx';
import { field } from '@labre/std/gfx';

import type { FrameworkBackgroundProps } from '../framework-background/index.js';
import { FrameworkBackgroundElementModel } from '../framework-background/index.js';
import { umlInNameBand } from './band.js';

/**
 * Height of a partition's NAME BAND — the strip its name is written in, in
 * model units.
 *
 * Declared HERE, in the model, and re-exported by `@labre/affine-gfx-uml`, for
 * the reason {@link UML_FRAME_BAND_HEIGHT} is: the partition's own hit test
 * reads it (a swimlane is clickable by its header as well as by its border),
 * and `affine-model` cannot reach into `affine-block-surface` where the
 * declaration is resolved. One number, owned by the layer that both the
 * declaration and the hit test can read.
 *
 * It is the band's THICKNESS whichever edge the band is on — the top for a
 * vertical lane, the left for a horizontal one — because §15.6.4 draws one
 * header strip and turns it with the lane rather than resizing it.
 *
 * 36 against the diagram frame's 44: a partition header is a name and not a
 * `<kind> <name>` heading, and it is written inside a lane that already sits on
 * a sheet, so it reads as a subdivision rather than as a second sheet.
 */
export const UML_PARTITION_BAND = 36;

/**
 * Which way a partition is sliced — the one thing §15.6.4 lets an author choose
 * about a swimlane, and the thing that decides which edge the header is on.
 *
 * `vertical` is a COLUMN: a tall lane with its name across the top, which is how
 * nearly every activity diagram anybody draws is laid out (the flow runs down,
 * the responsibilities run across). `horizontal` is a ROW, name up the left
 * edge, for the diagrams whose flow runs left to right.
 *
 * Two values and no more: §15.6.4 also draws a two-dimensional partition GRID,
 * and that is a phase-3 refinement — a grid is not a third orientation of one
 * lane, it is lanes crossed with lanes.
 */
export type UmlPartitionOrientation = 'vertical' | 'horizontal';

export type UmlPartitionProps = FrameworkBackgroundProps & {
  /** The partition name, written in its band — edited inline on dblclick. */
  name?: string;
  /** Which edge the band is on, and therefore which way the lane runs. */
  orientation?: UmlPartitionOrientation;
};

/**
 * An activity PARTITION — the swimlane of UML 2.5.1 §15.6.4: the strip drawn
 * across an activity diagram saying who (or what) is responsible for the
 * actions inside it.
 *
 * A framework background, so actions are dropped on it and connectors never
 * snap to it — but a TRANSPARENT one, like {@link UmlSubjectElementModel} and
 * for the same reason: a lane is drawn over an activity diagram that is already
 * there, and an opaque card would hide the very flow it is attributing.
 * Membership, as for every board in the library, is computed from geometry at
 * read time (R11) — an action belongs to the lane its CENTRE is in, and nothing
 * is stored on either element.
 *
 * ## Why a partition is an element and not a field on the frame
 *
 * Because a frame cannot grow a field without an ADR (the document format is a
 * red zone), and because the notation does not put it there either: §15.6.4
 * draws partitions as rectangles ON the diagram, freely positioned, freely
 * resized, and an activity diagram may carry none, one, or a dozen. A `lanes`
 * array on `umlDiagram` would have been a second geometry to keep in step with
 * the one the user drags.
 *
 * What it LOOKS like is declared, not coded: see `UML_PARTITION_FRAME_V` and
 * `UML_PARTITION_FRAME_H` in `@labre/affine-gfx-uml`.
 */
export class UmlPartitionElementModel extends FrameworkBackgroundElementModel<UmlPartitionProps> {
  get type() {
    return 'umlPartition';
  }

  @field('Partition')
  accessor name: string = 'Partition';

  /**
   * Which edge the name band is on — REQUIRED, with `vertical` as the default.
   *
   * Required for the reason `UmlDiagramElementModel.kind` is: it is part of the
   * NOTATION rather than a claim an author may decline to make. A partition with
   * no orientation has no header edge, so there would be nowhere to write its
   * name and nowhere to double-click to change it.
   */
  @field('vertical' as UmlPartitionOrientation)
  accessor orientation: UmlPartitionOrientation = 'vertical';

  @field(true)
  accessor resizeEnabled: boolean = true;

  @field(0)
  accessor rotate: number = 0;

  /**
   * Tall and narrow: the default is a COLUMN, because the default orientation
   * is vertical and a vertical lane is a strip an activity flows DOWN. Wide
   * enough for an action box (160) with room either side of it, and as tall as
   * the diagram frame it is dropped on.
   */
  @field()
  accessor xywh: SerializedXYWH = '[0,0,360,900]';

  /**
   * A partition is picked by its BORDER — and by its NAME BAND, the one
   * carve-out it keeps, on whichever edge its orientation puts it.
   *
   * The same carve-out the diagram frame makes and for the same reason: the band
   * is the only part of the lane that is the LANE rather than the flow drawn in
   * it. Without it the header would be unreachable, a background being picked by
   * its border alone — and a transparent lane's border is a thin line round a
   * region the user thinks of as a column.
   *
   * Nothing below the band is claimed, which matters more here than on the sheet:
   * a partition is drawn OVER actions, so every point that is not its own
   * furniture has to fall through to whatever is under the pointer.
   */
  override includesPoint(
    x: number,
    y: number,
    options?: PointTestOptions
  ): boolean {
    if (super.includesPoint(x, y, options)) return true;
    return umlInNameBand(
      this,
      this.orientation === 'horizontal' ? 'left' : 'top',
      UML_PARTITION_BAND,
      x,
      y
    );
  }
}
