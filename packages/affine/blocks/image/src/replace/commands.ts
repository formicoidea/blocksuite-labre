import { ImageBlockModel } from '@labre/affine-model';
import {
  AssetPickerProvider,
  TelemetryProvider,
} from '@labre/affine-shared/services';
import { openFilesWith } from '@labre/affine-shared/utils';
import type {
  AnyCommandDescriptor,
  BlockStdScope,
  CommandDescriptor,
  CommandInvocation,
} from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { z } from 'zod';

import { imagePropsFrom } from '../asset-picker.js';
import {
  IMAGE_REPLACE_WITH_IMAGE,
  IMAGE_REPLACE_WITH_IMAGE_DESCRIPTION,
  IMAGE_REPLACE_WITH_SHAPE,
  IMAGE_REPLACE_WITH_SHAPE_DESCRIPTION,
} from '../translations.js';
import { type ImageBlockSource, imageSourceFromFile } from '../utils.js';
import {
  canReplaceImageWithShape,
  canReplaceShapeWithImage,
  replaceImageWithShape,
  replaceShapeWithImage,
} from './replace-model.js';

/**
 * The two replace commands (ADR 0044), `owner: 'core'`: a shape and an image
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
 * The picture to put in: the host's asset dialog when there is one (`replace`
 * mode, one asset), the system file chooser otherwise — the rule of every
 * image entry point (`asset-picker.ts`). `null` when cancelled or refused.
 */
async function pickImage(std: BlockStdScope): Promise<ImageBlockSource | null> {
  const picker = std.getOptional(AssetPickerProvider);
  if (picker) {
    const assets = await picker.pick({
      kind: 'image',
      mode: 'replace',
      multiple: false,
      docId: std.store.id,
    });
    if (!assets?.length) return null;
    const [props] = await imagePropsFrom(std, assets.slice(0, 1));
    return props ?? null;
  }
  const [file] = (await openFilesWith('Images', false)) ?? [];
  return file ? imageSourceFromFile(std, file) : null;
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
      const image = await pickImage(std);
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

export const replaceImageWithShapeCommand: CommandDescriptor<ReplaceElementParams> =
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
    params: replaceElementParams,
    run: (std, invocation, params) => {
      const image = replaceableImage(std, params);
      if (!image) return;
      const id = replaceImageWithShape(std, image);
      if (!id) return;
      select(std, id);
      track(std, invocation, 'image', 'shape');
    },
  };

export const imageReplaceCommands: AnyCommandDescriptor[] = [
  replaceShapeWithImageCommand,
  replaceImageWithShapeCommand,
];
