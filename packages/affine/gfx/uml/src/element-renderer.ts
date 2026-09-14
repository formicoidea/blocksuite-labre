import {
  createFrameworkBackgroundRenderer,
  type ElementRenderer,
  ElementRendererExtension,
} from '@labre/affine-block-surface';
import type {
  UmlDiagramElementModel,
  UmlPartitionElementModel,
  UmlRegionElementModel,
  UmlSubjectElementModel,
} from '@labre/affine-model';

import {
  UML_DIAGRAM_FRAME,
  UML_PARTITION_FRAME_H,
  UML_PARTITION_FRAME_V,
  UML_REGION_FRAME,
  UML_SUBJECT_FRAME,
} from './background.js';
import {
  UML_DIAGRAM_MARGIN,
  UML_FRAME_BAND_HEIGHT,
  UML_FRAME_BORDER_WIDTH,
  UML_FRAME_INK,
  UML_FRAME_TAG_CUT,
  UML_FRAME_TAG_FOOT,
} from './consts.js';
import { withUmlFrameTag } from './frame-tag.js';

/**
 * Canvas renderers for the four UML frames.
 *
 * There is almost no UML drawing code here: both are INSTANTIATIONS of the
 * framework-background primitive, configured by the declarations in
 * `background.ts`. The diagram frame adds exactly one thing the primitive has no
 * vocabulary for — the cut-corner heading tag of Annex A — through the decorator
 * in `frame-tag.ts`.
 *
 * Exported as functions as well as extensions because the fidelity suite drives
 * them directly with a canvas stub.
 */

export const umlDiagram: ElementRenderer<UmlDiagramElementModel> =
  withUmlFrameTag<UmlDiagramElementModel>(UML_DIAGRAM_FRAME, {
    // The DERIVED `<kind> <name>` the declaration's band label paints.
    prop: 'heading',
    bandHeight: UML_FRAME_BAND_HEIGHT,
    foot: UML_FRAME_TAG_FOOT,
    // The plot's left inset: the heading starts there, so a tag padded by the
    // same number has its words centred in it, with one number and no drift.
    padding: UML_DIAGRAM_MARGIN,
    cut: UML_FRAME_TAG_CUT,
    stroke: UML_FRAME_INK,
    lineWidth: UML_FRAME_BORDER_WIDTH,
  });

export const UmlDiagramRendererExtension = ElementRendererExtension(
  UML_DIAGRAM_FRAME.type,
  umlDiagram
);

export const umlSubject: ElementRenderer<UmlSubjectElementModel> =
  createFrameworkBackgroundRenderer<UmlSubjectElementModel>(UML_SUBJECT_FRAME);

export const UmlSubjectRendererExtension = ElementRendererExtension(
  UML_SUBJECT_FRAME.type,
  umlSubject
);

/**
 * The activity partition (§15.6.4), in whichever orientation the element
 * declares.
 *
 * The one renderer in the pack that CHOOSES a declaration rather than being
 * built from one, and the choice is two lines because the alternative is a
 * change to the declaration language: a side band's edge and the geometry's deep
 * margin are not things `variantProp` can vary (`background.ts` states the
 * argument in full). So two renderers are built at module load — no work per
 * frame — and the element's own prop picks between them.
 *
 * An orientation this build has never heard of paints the VERTICAL lane rather
 * than nothing, the same promise the diagram frame's heading makes about an
 * unknown kind.
 */
const umlPartitionV =
  createFrameworkBackgroundRenderer<UmlPartitionElementModel>(
    UML_PARTITION_FRAME_V
  );
const umlPartitionH =
  createFrameworkBackgroundRenderer<UmlPartitionElementModel>(
    UML_PARTITION_FRAME_H
  );

export const umlPartition: ElementRenderer<UmlPartitionElementModel> = (
  model,
  ...rest
) =>
  (model.orientation === 'horizontal' ? umlPartitionH : umlPartitionV)(
    model,
    ...rest
  );

export const UmlPartitionRendererExtension = ElementRendererExtension(
  UML_PARTITION_FRAME_V.type,
  umlPartition
);

/** The composite state (§14.2.4) — one declaration, no orientation to turn. */
export const umlRegion: ElementRenderer<UmlRegionElementModel> =
  createFrameworkBackgroundRenderer<UmlRegionElementModel>(UML_REGION_FRAME);

export const UmlRegionRendererExtension = ElementRendererExtension(
  UML_REGION_FRAME.type,
  umlRegion
);
