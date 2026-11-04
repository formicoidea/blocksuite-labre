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

import { type AssetPickerRequest } from '@labre/affine-shared/services';

import { pickReplacement, type ReplacementAnswer } from '../asset-picker.js';
import {
  IMAGE_REPLACE_PICTURE_DESCRIPTION,
  IMAGE_REPLACE_WITH_ASSET,
  IMAGE_REPLACE_WITH_IMAGE_DESCRIPTION,
  IMAGE_REPLACE_WITH_SHAPE,
  IMAGE_REPLACE_WITH_SHAPE_DESCRIPTION,
} from '../translations.js';
import {
  canReplaceImageWithShape,
  canReplaceShapeWithImage,
  replaceImageWithShape,
  replaceWithAnswer,
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

export function replaceTarget(std: BlockStdScope, params: unknown): unknown {
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
  const model = replaceTarget(std, params);
  return canReplaceShapeWithImage(std, model) ? model : null;
}

/** The canvas image the command would replace, or `null`. */
export function replaceableImage(std: BlockStdScope, params?: unknown) {
  const model = replaceTarget(std, params);
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
  const model = replaceTarget(std, params);
  if (std.store.readonly || !(model instanceof ImageBlockModel)) return null;
  if (model.parent?.flavour !== 'affine:surface') return null;
  return model.isLocked() ? null : model;
}

type ReplacedKind = 'shape' | 'image' | 'attachment';

const CREATED_FLAVOUR = {
  image: 'affine:image',
  attachment: 'affine:attachment',
} as const;

/**
 * Kinds only, never an id, a `sourceId` or content. A block inserted by a user action
 * is also `BlockCreated`, so "images created" stays one series.
 */
export function reportReplaced(
  std: BlockStdScope,
  invocation: Pick<CommandInvocation, 'source' | 'surface'>,
  from: ReplacedKind,
  to: ReplacedKind
) {
  const telemetry = std.getOptional(TelemetryProvider);
  const common = {
    page: 'whiteboard editor',
    control: invocation.source,
    module: invocation.surface,
  } as const;
  if (to !== 'shape' && to !== from) {
    telemetry?.track('BlockCreated', {
      ...common,
      blockType: CREATED_FLAVOUR[to],
    });
  }
  telemetry?.track('ElementReplaced', { ...common, from, to });
}

export function selectReplaced(std: BlockStdScope, id: string) {
  std.get(GfxControllerIdentifier).selection.set({
    elements: [id],
    editing: false,
  });
}

/**
 * The dialog, then the target as it is AFTER it (the dialog took time: it may be gone,
 * locked or the document read-only by now), then the answer, whatever its type.
 */
export async function replaceFromDialog<M extends object>(
  std: BlockStdScope,
  invocation: CommandInvocation,
  params: unknown,
  how: {
    target: (std: BlockStdScope, params: unknown) => M | null;
    from: ReplacedKind;
    request: AssetPickerRequest['kind'];
    write: (
      std: BlockStdScope,
      model: M,
      answer: ReplacementAnswer
    ) => string | null;
  }
) {
  if (!how.target(std, params)) return;
  const answer = await pickReplacement(std, how.request);
  if (!answer) return;
  const model = how.target(std, params);
  if (!model) return;
  const id = how.write(std, model, answer);
  if (!id) return;
  if (id !== (model as { id?: string }).id) selectReplaced(std, id);
  reportReplaced(
    std,
    invocation,
    how.from,
    answer.kind === 'image' ? 'image' : 'attachment'
  );
}

export const REPLACE_SHAPE_WITH_IMAGE = 'canvas.shape.replaceWithImage';
export const REPLACE_IMAGE_WITH_SHAPE = 'canvas.image.replaceWithShape';
export const REPLACE_IMAGE_WITH_IMAGE = 'canvas.image.replaceWithImage';

export const replaceShapeWithImageCommand: CommandDescriptor<ReplaceElementParams> =
  {
    id: REPLACE_SHAPE_WITH_IMAGE,
    owner: 'core',
    kind: 'action',
    labelKey: IMAGE_REPLACE_WITH_ASSET[0],
    labelFallback: IMAGE_REPLACE_WITH_ASSET[1],
    descriptionKey: IMAGE_REPLACE_WITH_IMAGE_DESCRIPTION[0],
    descriptionFallback: IMAGE_REPLACE_WITH_IMAGE_DESCRIPTION[1],
    keywords: ['replace', 'image', 'picture', 'shape', 'file'],
    // Not `agent`: the picture comes from a dialog a person answers.
    surfaces: ['contextual-toolbar', 'palette'],
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    availability: 'editable',
    when: std => replaceableShape(std) !== null,
    params: replaceElementParams,
    run: (std, invocation, params) =>
      replaceFromDialog(std, invocation, params, {
        target: replaceableShape,
        from: 'shape',
        request: 'image',
        write: replaceWithAnswer,
      }),
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
      selectReplaced(std, id);
      reportReplaced(std, invocation, 'image', 'shape');
    },
  };

/**
 * The dialog entry on a canvas IMAGE (ADR 0044, amendments of 2026-10-27 and
 * 2026-11-04): from the host's library when there is one, from the system file
 * chooser otherwise, so it exists without a host. A picture stays in the same block,
 * its id, frame and caption kept; a file takes its place. The id says image: ids are
 * never removed.
 */
export const replaceImageWithImageCommand: CommandDescriptor<ReplaceElementParams> =
  {
    id: REPLACE_IMAGE_WITH_IMAGE,
    owner: 'core',
    kind: 'action',
    labelKey: IMAGE_REPLACE_WITH_ASSET[0],
    labelFallback: IMAGE_REPLACE_WITH_ASSET[1],
    descriptionKey: IMAGE_REPLACE_PICTURE_DESCRIPTION[0],
    descriptionFallback: IMAGE_REPLACE_PICTURE_DESCRIPTION[1],
    keywords: ['replace', 'image', 'picture', 'library', 'swap', 'file'],
    // Not `agent`: the picture comes from a dialog a person answers.
    surfaces: ['contextual-toolbar', 'palette'],
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    availability: 'editable',
    when: std => replaceablePicture(std) !== null,
    params: replaceElementParams,
    run: (std, invocation, params) =>
      replaceFromDialog(std, invocation, params, {
        target: replaceablePicture,
        from: 'image',
        request: 'image',
        write: replaceWithAnswer,
      }),
  };

export const imageReplaceCommands: AnyCommandDescriptor[] = [
  replaceShapeWithImageCommand,
  replaceImageWithShapeCommand,
  replaceImageWithImageCommand,
];
