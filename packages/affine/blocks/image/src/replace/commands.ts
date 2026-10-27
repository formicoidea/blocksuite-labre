import { ImageBlockModel, ShapeType } from '@labre/affine-model';
import { TelemetryProvider } from '@labre/affine-shared/services';
import type {
  AnyCommandDescriptor,
  BlockStdScope,
  CommandDescriptor,
  CommandInvocation,
} from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { z } from 'zod';

import { pickImageSource, replaceImageSource } from '../asset-picker.js';
import {
  IMAGE_REPLACE_PICTURE_DESCRIPTION,
  IMAGE_REPLACE_WITH_IMAGE,
  IMAGE_REPLACE_WITH_IMAGE_DESCRIPTION,
  IMAGE_REPLACE_WITH_SHAPE,
  IMAGE_REPLACE_WITH_SHAPE_DESCRIPTION,
} from '../translations.js';
import {
  canReplaceImageWithShape,
  canReplaceShapeWithImage,
  replaceImageWithShape,
  replaceShapeWithImage,
} from './replace-model.js';

/**
 * The replace commands (ADR 0044), `owner: 'core'`: a shape and an image
 * belong to no framework. Registered from the image view extension, so they
 * go with the `image` flag; the toolbar entries invoke them through
 * `runCommand`, so the refusal, the one undo step and the telemetry live
 * here, once.
 *
 * They EMIT FROM THEIR BODY (listed in `registry.unit.spec.ts`'s
 * self-emitting commands): `CommandDescriptor.telemetry` maps onto the
 * framework creation events, and whether anything was replaced is a fact of
 * the invocation — a cancelled file chooser replaces nothing.
 */

export const replaceElementParams = z.object({
  // The element to replace; absent, the single selected one.
  elementId: z.string().min(1).optional(),
});

export type ReplaceElementParams = z.infer<typeof replaceElementParams>;

/**
 * « Replace with shape » takes the shape picked in its sub-menu (ADR 0044,
 * amendment of 2026-10-27). Both optional: absent, a plain rectangle, so the
 * palette and the agent keep the v1 behaviour.
 */
export const replaceWithShapeParams = replaceElementParams.extend({
  shapeType: z.nativeEnum(ShapeType).optional(),
  // The corner radius as a fraction of the box: 0.1 is the rounded rectangle.
  radius: z.number().min(0).max(0.5).optional(),
});

export type ReplaceWithShapeParams = z.infer<typeof replaceWithShapeParams>;

function target(std: BlockStdScope, params: unknown): unknown {
  const parsed = replaceElementParams.safeParse(params ?? {});
  if (!parsed.success) return null;
  const gfx = std.get(GfxControllerIdentifier);
  const { elementId } = parsed.data;
  if (elementId !== undefined) return gfx.getElementById(elementId);
  const selected = gfx.selection.selectedElements;
  return selected.length === 1 ? selected[0] : null;
}

/** The shape the command would replace, or `null`. */
export function replaceableShape(std: BlockStdScope, params?: unknown) {
  const model = target(std, params);
  return canReplaceShapeWithImage(std, model) ? model : null;
}

/** The canvas image the command would replace, or `null`. */
export function replaceableImage(std: BlockStdScope, params?: unknown) {
  const model = target(std, params);
  return model instanceof ImageBlockModel &&
    canReplaceImageWithShape(std, model)
    ? model
    : null;
}

/**
 * The canvas image whose PICTURE the command would swap, or `null`. Looser
 * than {@link replaceableImage}: the block stays (same id, caption and
 * comments kept), so a captioned image may change its picture; a locked one
 * may not.
 */
export function replaceablePicture(std: BlockStdScope, params?: unknown) {
  const model = target(std, params);
  if (std.store.readonly || !(model instanceof ImageBlockModel)) return null;
  if (model.parent?.flavour !== 'affine:surface') return null;
  return model.isLocked() ? null : model;
}

function track(
  std: BlockStdScope,
  invocation: CommandInvocation,
  from: 'shape' | 'image',
  to: 'shape' | 'image'
) {
  std.getOptional(TelemetryProvider)?.track('ElementReplaced', {
    page: 'whiteboard editor',
    from,
    to,
    control: invocation.source,
    module: invocation.surface,
  });
}

function select(std: BlockStdScope, id: string) {
  std.get(GfxControllerIdentifier).selection.set({
    elements: [id],
    editing: false,
  });
}

export const REPLACE_SHAPE_WITH_IMAGE = 'canvas.shape.replaceWithImage';
export const REPLACE_IMAGE_WITH_SHAPE = 'canvas.image.replaceWithShape';
export const REPLACE_IMAGE_WITH_IMAGE = 'canvas.image.replaceWithImage';

export const replaceShapeWithImageCommand: CommandDescriptor<ReplaceElementParams> =
  {
    id: REPLACE_SHAPE_WITH_IMAGE,
    owner: 'core',
    kind: 'action',
    labelKey: IMAGE_REPLACE_WITH_IMAGE[0],
    labelFallback: IMAGE_REPLACE_WITH_IMAGE[1],
    descriptionKey: IMAGE_REPLACE_WITH_IMAGE_DESCRIPTION[0],
    descriptionFallback: IMAGE_REPLACE_WITH_IMAGE_DESCRIPTION[1],
    keywords: ['replace', 'image', 'picture', 'shape'],
    // Not `agent`: the picture comes from a dialog a person answers.
    surfaces: ['contextual-toolbar', 'palette'],
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    availability: 'editable',
    when: std => replaceableShape(std) !== null,
    params: replaceElementParams,
    run: async (std, invocation, params) => {
      if (!replaceableShape(std, params)) return;
      const image = await pickImageSource(std);
      if (!image) return;
      // Re-read: the dialog took time, the shape may be gone, locked or the
      // document read-only by now.
      const shape = replaceableShape(std, params);
      if (!shape) return;
      const id = replaceShapeWithImage(std, shape, image);
      if (!id) return;
      select(std, id);
      std.getOptional(TelemetryProvider)?.track('BlockCreated', {
        page: 'whiteboard editor',
        blockType: 'affine:image',
        control: invocation.source,
        module: invocation.surface,
      });
      track(std, invocation, 'shape', 'image');
    },
  };

export const replaceImageWithShapeCommand: CommandDescriptor<ReplaceWithShapeParams> =
  {
    id: REPLACE_IMAGE_WITH_SHAPE,
    owner: 'core',
    kind: 'action',
    labelKey: IMAGE_REPLACE_WITH_SHAPE[0],
    labelFallback: IMAGE_REPLACE_WITH_SHAPE[1],
    descriptionKey: IMAGE_REPLACE_WITH_SHAPE_DESCRIPTION[0],
    descriptionFallback: IMAGE_REPLACE_WITH_SHAPE_DESCRIPTION[1],
    keywords: ['replace', 'shape', 'rectangle', 'placeholder', 'image'],
    surfaces: ['contextual-toolbar', 'palette', 'agent'],
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    availability: 'editable',
    when: std => replaceableImage(std) !== null,
    params: replaceWithShapeParams,
    run: (std, invocation, params) => {
      const image = replaceableImage(std, params);
      if (!image) return;
      const parsed = replaceWithShapeParams.safeParse(params ?? {});
      if (!parsed.success) return;
      const { shapeType, radius } = parsed.data;
      const id = replaceImageWithShape(std, image, { shapeType, radius });
      if (!id) return;
      select(std, id);
      track(std, invocation, 'image', 'shape');
    },
  };

/**
 * « Replace with image » on a canvas IMAGE (ADR 0044, amendment of
 * 2026-10-27): another picture in the same block, from the host's library
 * when there is one, from the system file chooser otherwise — so the entry
 * exists without a host. The block keeps its id, corner, width and caption
 * (`replaceImageSource`); it reports `ElementReplaced { image → image }`.
 */
export const replaceImageWithImageCommand: CommandDescriptor<ReplaceElementParams> =
  {
    id: REPLACE_IMAGE_WITH_IMAGE,
    owner: 'core',
    kind: 'action',
    labelKey: IMAGE_REPLACE_WITH_IMAGE[0],
    labelFallback: IMAGE_REPLACE_WITH_IMAGE[1],
    descriptionKey: IMAGE_REPLACE_PICTURE_DESCRIPTION[0],
    descriptionFallback: IMAGE_REPLACE_PICTURE_DESCRIPTION[1],
    keywords: ['replace', 'image', 'picture', 'library', 'swap'],
    // Not `agent`: the picture comes from a dialog a person answers.
    surfaces: ['contextual-toolbar', 'palette'],
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    availability: 'editable',
    when: std => replaceablePicture(std) !== null,
    params: replaceElementParams,
    run: async (std, invocation, params) => {
      if (!replaceablePicture(std, params)) return;
      const source = await pickImageSource(std);
      if (!source) return;
      // Re-read after the dialog, like the shape's.
      const image = replaceablePicture(std, params);
      if (!image || !replaceImageSource(image, source)) return;
      track(std, invocation, 'image', 'image');
    },
  };

export const imageReplaceCommands: AnyCommandDescriptor[] = [
  replaceShapeWithImageCommand,
  replaceImageWithShapeCommand,
  replaceImageWithImageCommand,
];
