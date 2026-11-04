import { ShapeComponentConfig } from '@labre/affine-gfx-shape';
import {
  EditorChevronDown,
  type EditorMenuButton,
  renderPickerMenuItems,
} from '@labre/affine-components/toolbar';
import {
  getShapeRadius,
  getShapeType,
  type ShapeName,
  ShapeElementModel,
} from '@labre/affine-model';
import {
  type ToolbarAction,
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
  toolbarModuleKey,
  translateKey,
} from '@labre/affine-shared/services';
import {
  ArrowRightSmallIcon,
  ImageIcon,
  ReplaceIcon,
  ShapeIcon,
} from '@blocksuite/icons/lit';
import type { ButtonPopperOptions } from '@labre/affine-shared/utils';
import {
  BlockFlavourIdentifier,
  type BlockStdScope,
  runCommand,
} from '@labre/std';
import { html, nothing } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';

import {
  IMAGE_REPLACE_WITH_ASSET,
  IMAGE_REPLACE_WITH_SHAPE,
  IMAGE_TOOLBAR_REPLACE,
} from '../translations.js';
import {
  replaceableImage,
  replaceablePicture,
  replaceableShape,
  replaceImageWithImageCommand,
  replaceImageWithShapeCommand,
  replaceShapeWithImageCommand,
} from './commands.js';
import type { ReplacementShape } from './replace-model.js';

const FROM_TOOLBAR = {
  surface: 'contextual-toolbar',
  source: 'toolbar:general',
} as const;

/**
 * A click inside the shape sub-menu must not reach `document`: every
 * `editor-menu-button` closes on a click outside its own trigger
 * (`listenClickAway`), and the sub-menu's trigger and row are outside the
 * Replace menu's trigger, so the outer menu would close — and take the
 * sub-menu, which it contains, with it — on the very click that opens it.
 */
const keepOpen = (event: Event) => event.stopPropagation();

/**
 * Beside the menu, as a sub-menu opens. One object, not a literal per render:
 * `editor-menu-button` rebuilds its popper whenever `popperOptions` changes
 * identity, which would drop an open sub-menu on any toolbar re-render.
 */
const SUBMENU_POPPER: Partial<ButtonPopperOptions> = {
  allowedPlacements: ['right-start', 'left-start'],
  mainAxis: 8,
};

function renderShapeSubmenu(
  ctx: ToolbarContext,
  outer: ReturnType<typeof createRef<EditorMenuButton>>,
  toShape: (std: BlockStdScope, shape: ReplacementShape) => void
) {
  const label = translateKey(ctx.std, ...IMAGE_REPLACE_WITH_SHAPE);
  const onPick = (name: ShapeName | null) => {
    if (!name) return;
    outer.value?.hide();
    toShape(ctx.std, {
      shapeType: getShapeType(name),
      radius: getShapeRadius(name),
    });
  };
  // The shape tool's own list — names, icons and wordings — so the sub-menu
  // offers exactly the shapes a user can draw, in the same order.
  const items = ShapeComponentConfig.map(item => ({
    key: translateKey(ctx.std, ...item.tooltipWording),
    value: item.name as ShapeName | null,
    icon: item.generalIcon,
    disabled: item.disabled,
  }));

  return html`
    <div @click=${keepOpen}>
      <editor-menu-button
        data-testid="image-replace-shape"
        .contentPadding=${'4px 6px'}
        .popperOptions=${SUBMENU_POPPER}
        .button=${html`
          <editor-icon-button
            aria-label=${label}
            data-testid="image-replace-shape-button"
            .justify=${'space-between'}
            .iconContainerPadding=${[4, 8]}
            .iconContainerWidth=${'100%'}
          >
            ${ShapeIcon()}
            <span class="label">${label}</span>
            ${ArrowRightSmallIcon()}
          </editor-icon-button>
        `}
      >
        <div>
          ${renderPickerMenuItems(items, null, onPick, 'image-replace-shape')}
        </div>
      </editor-menu-button>
    </div>
  `;
}

/**
 * « Replace » on a canvas element's toolbar (ADR 0044, amendments of 2026-10-27 and
 * 2026-11-04): ONE menu, for an image and for an attachment. An entry opens the
 * dialog, whose answer may be any type, and a sub-menu lists the shape tool's shapes.
 * Each entry shows only when its command would act.
 */
export function replaceMenuToolbarAction(how: {
  id: string;
  canPick: (std: BlockStdScope) => boolean;
  canShape: (std: BlockStdScope) => boolean;
  pick: (std: BlockStdScope) => void;
  toShape: (std: BlockStdScope, shape: ReplacementShape) => void;
  disabled?: (ctx: ToolbarContext) => boolean;
}): ToolbarAction {
  return {
    id: how.id,
    when: ctx =>
      !ctx.readonly && (how.canPick(ctx.std) || how.canShape(ctx.std)),
    content(ctx) {
      const picture = how.canPick(ctx.std);
      const toShape = how.canShape(ctx.std);
      if (!picture && !toShape) return null;
      const label = translateKey(ctx.std, ...IMAGE_TOOLBAR_REPLACE);
      const withImage = translateKey(ctx.std, ...IMAGE_REPLACE_WITH_ASSET);
      const outer = createRef<EditorMenuButton>();

      return html`
        <editor-menu-button
          ${ref(outer)}
          data-testid="image-replace-menu"
          .contentPadding=${'8px'}
          .button=${html`
            <editor-icon-button
              aria-label=${label}
              data-testid="image-replace-button"
              .tooltip=${label}
              .disabled=${how.disabled?.(ctx) ?? false}
            >
              ${ReplaceIcon()} ${EditorChevronDown}
            </editor-icon-button>
          `}
        >
          <div data-size="large" data-orientation="vertical">
            ${picture
              ? html`
                  <editor-menu-action
                    aria-label=${withImage}
                    data-testid="image-replace-with-image"
                    @click=${() => how.pick(ctx.std)}
                  >
                    ${ImageIcon()}
                    <span class="label">${withImage}</span>
                  </editor-menu-action>
                `
              : nothing}
            ${toShape ? renderShapeSubmenu(ctx, outer, how.toShape) : nothing}
          </div>
        </editor-menu-button>
      `;
    },
  };
}

/** It keeps the id `a.replace`, so it sits where the old « Replace » did. */
export const imageReplaceMenuToolbarAction = replaceMenuToolbarAction({
  id: 'a.replace',
  canPick: std => replaceablePicture(std) !== null,
  canShape: std => replaceableImage(std) !== null,
  pick: std => runCommand(std, replaceImageWithImageCommand, FROM_TOOLBAR),
  toShape: (std, shape) =>
    runCommand(std, replaceImageWithShapeCommand, FROM_TOOLBAR, shape),
});

const shapeReplaceToolbarConfig = {
  actions: [
    {
      id: 'h.replace-with-image',
      tooltip: IMAGE_REPLACE_WITH_ASSET[1],
      tooltipWording: IMAGE_REPLACE_WITH_ASSET,
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
 * it to the same row. Replacing a shape with ANOTHER shape is the shape
 * toolbar's own « Switch shape type », not repeated here.
 */
export const shapeReplaceWithImageToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier(
    toolbarModuleKey('affine:surface:shape', 'image-replace')
  ),
  config: shapeReplaceToolbarConfig,
});
