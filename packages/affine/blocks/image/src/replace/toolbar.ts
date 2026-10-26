import { ShapeElementModel } from '@labre/affine-model';
import {
  type ToolbarAction,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
  toolbarModuleKey,
} from '@labre/affine-shared/services';
import { ImageIcon, ShapeIcon } from '@blocksuite/icons/lit';
import { BlockFlavourIdentifier, runCommand } from '@labre/std';

import {
  IMAGE_REPLACE_WITH_IMAGE,
  IMAGE_REPLACE_WITH_SHAPE,
} from '../translations.js';
import {
  replaceableImage,
  replaceableShape,
  replaceImageWithShapeCommand,
  replaceShapeWithImageCommand,
} from './commands.js';

const FROM_TOOLBAR = {
  surface: 'contextual-toolbar',
  source: 'toolbar:general',
} as const;

/**
 * « Replace with shape » on a canvas image's toolbar, beside « Replace »
 * (ADR 0044). Shown only when the command would act.
 */
export const imageReplaceWithShapeToolbarAction: ToolbarAction = {
  id: 'a.replace-with-shape',
  tooltip: IMAGE_REPLACE_WITH_SHAPE[1],
  tooltipWording: IMAGE_REPLACE_WITH_SHAPE,
  icon: ShapeIcon(),
  when: ctx => !ctx.readonly && replaceableImage(ctx.std) !== null,
  run: ctx => runCommand(ctx.std, replaceImageWithShapeCommand, FROM_TOOLBAR),
};

const shapeReplaceToolbarConfig = {
  actions: [
    {
      id: 'h.replace-with-image',
      tooltip: IMAGE_REPLACE_WITH_IMAGE[1],
      tooltipWording: IMAGE_REPLACE_WITH_IMAGE,
      icon: ImageIcon(),
      when: ctx => !ctx.readonly && replaceableShape(ctx.std) !== null,
      run: ctx =>
        runCommand(ctx.std, replaceShapeWithImageCommand, FROM_TOOLBAR),
    },
  ],
  when: ctx => ctx.getSurfaceModelsByType(ShapeElementModel).length === 1,
} as const satisfies ToolbarModuleConfig;

/**
 * « Replace with image » on the SHAPE toolbar, registered from this package:
 * `gfx/shape` never imports the image block. The bare
 * `affine:surface:shape` key belongs to `shapeToolbarExtension`, so this
 * second module carries an owner (`toolbarModuleKey`) and the registry hands
 * it to the same row.
 */
export const shapeReplaceWithImageToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier(
    toolbarModuleKey('affine:surface:shape', 'image-replace')
  ),
  config: shapeReplaceToolbarConfig,
});
