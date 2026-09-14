import {
  createFrameworkBackgroundRenderer,
  type ElementRenderer,
  ElementRendererExtension,
} from '@labre/affine-block-surface';
import type {
  UmlDiagramElementModel,
  UmlSubjectElementModel,
} from '@labre/affine-model';

import { UML_DIAGRAM_FRAME, UML_SUBJECT_FRAME } from './background.js';
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
 * Canvas renderers for the two UML frames.
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
