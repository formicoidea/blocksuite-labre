import { EdgelessCRUDIdentifier } from '@labre/affine-block-surface';
import {
  packColor,
  type PickColorEvent,
} from '@labre/affine-components/color-picker';
import type { LineDetailType } from '@labre/affine-components/edgeless-line-styles-panel';
import { createTextActions } from '@labre/affine-gfx-text';
import {
  type Color,
  DefaultTheme,
  FontFamily,
  getShapeName,
  getShapeRadius,
  getShapeType,
  isTransparent,
  LineWidth,
  MindmapElementModel,
  type Palette,
  resolveColor,
  ShapeElementModel,
  type ShapeName,
  ShapeStyle,
  ShapeType,
  StrokeStyle,
  TextFitMode,
} from '@labre/affine-model';
import {
  STYLE_MENU_LABEL,
  type ToolbarGenericAction,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
  translateKey,
} from '@labre/affine-shared/services';
import { getMostCommonValue } from '@labre/affine-shared/utils';
import {
  getRootBlock,
  LINE_STYLE_LIST,
  renderMenu,
} from '@labre/affine-widget-edgeless-toolbar';
import { Bound } from '@labre/global/gfx';
import {
  AddTextIcon,
  AutoHeightIcon,
  AutoSizeIcon,
  EditIcon,
  ScaleAltIcon,
  ShapeIcon,
} from '@blocksuite/icons/lit';
import { BlockFlavourIdentifier } from '@labre/std';
import { html } from 'lit';
import isEqual from 'lodash-es/isEqual';

import { normalizeShapeBound } from '../element-renderer';
import { ShapeElementView } from '../element-view';
import type { ShapeToolOption } from '../shape-tool';
import { applyTextFitMode, nextTextFitMode } from '../text-fit';
import { mountShapeTextEditor } from '../text/edgeless-shape-text-editor';
import { ShapeComponentConfig } from './shape-menu-config';
import {
  SHAPE_ADD_TEXT_TOOLTIP,
  SHAPE_EDIT_VERTICES_TOOLTIP,
  SHAPE_SWITCH_TYPE_LABEL,
  SHAPE_TEXT_FIT_ARIA,
  SHAPE_TEXT_FIT_CONTAINED,
  SHAPE_TEXT_FIT_GROW,
  SHAPE_TEXT_FIT_OVERFLOW,
  SHAPE_TEXT_FIT_TOOLTIP,
} from '../translations';

/** Icon + wording per text fit mode for the cycling toolbar button. */
const TEXT_FIT_UI = {
  [TextFitMode.Grow]: { icon: AutoHeightIcon(), wording: SHAPE_TEXT_FIT_GROW },
  [TextFitMode.Contained]: {
    icon: AutoSizeIcon(),
    wording: SHAPE_TEXT_FIT_CONTAINED,
  },
  [TextFitMode.Overflow]: {
    icon: ScaleAltIcon(),
    wording: SHAPE_TEXT_FIT_OVERFLOW,
  },
} as const;

export const shapeToolbarConfig = {
  actions: [
    {
      id: 'c.switch-type',
      when(ctx) {
        const models = ctx.getSurfaceModelsByType(ShapeElementModel);
        return models.length > 0 && models.every(model => !hasGrouped(model));
      },
      content(ctx) {
        const models = ctx.getSurfaceModelsByType(ShapeElementModel);
        if (!models.length) return null;

        const shapeStyle = ctx.features.getFlag(
          'enable_edgeless_scribbled_style'
        )
          ? (getMostCommonValue(models, 'shapeStyle') ?? ShapeStyle.General)
          : ShapeStyle.General;

        const shapeName =
          getMostCommonValue<ShapeToolOption, 'shapeName'>(
            models.map(model => ({
              shapeName: getShapeName(model.shapeType, model.radius),
            })),
            'shapeName'
          ) ?? ShapeType.Rect;

        const onPick = (shapeName: ShapeName) => {
          const shapeType = getShapeType(shapeName);
          const radius = getShapeRadius(shapeName);

          ctx.std.store.captureSync();

          for (const model of models) {
            ctx.std
              .get(EdgelessCRUDIdentifier)
              .updateElement(model.id, { shapeType, radius });
          }
        };

        return renderMenu({
          icon: ShapeIcon(),
          label: 'Switch shape type',
          labelWording: SHAPE_SWITCH_TYPE_LABEL,
          items: ShapeComponentConfig.map(item => ({
            key: item.tooltip,
            keyWording: item.tooltipWording,
            value: item.name,
            icon:
              shapeStyle === ShapeStyle.General
                ? item.generalIcon
                : item.scribbledIcon,
            disabled: item.disabled,
          })),
          currentValue: shapeName,
          onPick,
          std: ctx.std,
        });
      },
    },
    {
      id: 'd.style',
      when: ctx => ctx.features.getFlag('enable_edgeless_scribbled_style'),
      content(ctx) {
        const models = ctx.getSurfaceModelsByType(ShapeElementModel);
        if (!models.length) return null;

        const field = 'shapeStyle';
        const shapeStyle =
          getMostCommonValue(models, field) ?? ShapeStyle.General;
        const onPick = (value: boolean) => {
          const shapeStyle = value ? ShapeStyle.Scribbled : ShapeStyle.General;
          const fontFamily = value ? FontFamily.Kalam : FontFamily.Inter;

          for (const model of models) {
            ctx.std
              .get(EdgelessCRUDIdentifier)
              .updateElement(model.id, { shapeStyle, fontFamily });
          }
        };

        return renderMenu({
          label: 'Style',
          labelWording: STYLE_MENU_LABEL,
          items: LINE_STYLE_LIST,
          currentValue: shapeStyle === ShapeStyle.Scribbled,
          onPick,
          std: ctx.std,
        });
      },
    },
    {
      id: 'e.color',
      when(ctx) {
        const models = ctx.getSurfaceModelsByType(ShapeElementModel);
        return models.length > 0 && models.every(model => !hasGrouped(model));
      },
      content(ctx) {
        const models = ctx.getSurfaceModelsByType(ShapeElementModel);
        if (!models.length) return null;

        const enableCustomColor = ctx.features.getFlag('enable_color_picker');
        const theme = ctx.theme.edgeless$.value;

        const firstModel = models[0];
        const originalFillColor = firstModel.fillColor;
        const originalStrokeColor = firstModel.strokeColor;

        const mapped = models.map(
          ({ filled, fillColor, strokeColor, strokeWidth, strokeStyle }) => ({
            fillColor: filled
              ? resolveColor(fillColor, theme)
              : DefaultTheme.transparent,
            strokeColor: resolveColor(strokeColor, theme),
            strokeWidth,
            strokeStyle,
          })
        );
        const fillColor =
          getMostCommonValue(mapped, 'fillColor') ??
          resolveColor(DefaultTheme.shapeFillColor, theme);
        const strokeColor =
          getMostCommonValue(mapped, 'strokeColor') ??
          resolveColor(DefaultTheme.shapeStrokeColor, theme);
        const strokeWidth =
          getMostCommonValue(mapped, 'strokeWidth') ?? LineWidth.Four;
        const strokeStyle =
          getMostCommonValue(mapped, 'strokeStyle') ?? StrokeStyle.Solid;

        const pickColorWrapper =
          (field: string, pickCallback: (palette: Palette) => void) =>
          (e: CustomEvent<PickColorEvent>) => {
            e.stopPropagation();

            switch (e.detail.type) {
              case 'pick':
                pickCallback(e.detail.detail);
                break;
              case 'start':
                ctx.store.captureSync();
                models.forEach(model => {
                  model.stash(field);
                });
                break;
              case 'end':
                ctx.store.transact(() => {
                  models.forEach(model => {
                    model.pop(field);
                  });
                });
            }
          };

        const onPickFillColor = pickColorWrapper('fillColor', palette => {
          const value = palette.value;
          const filled = isTransparent(value);
          const props = packColor('fillColor', value);
          const crud = ctx.std.get(EdgelessCRUDIdentifier);
          models.forEach(model => {
            if (filled && !model.filled) {
              const color = getTextColor(value, filled);
              Object.assign(props, { filled, color });
            }
            crud.updateElement(model.id, props);
          });
        });

        const onPickStrokeColor = pickColorWrapper('strokeColor', palette => {
          const value = palette.value;
          const props = packColor('strokeColor', value);
          const crud = ctx.std.get(EdgelessCRUDIdentifier);
          models.forEach(model => {
            crud.updateElement(model.id, props);
          });
        });

        const onPickStrokeStyle = (e: CustomEvent<LineDetailType>) => {
          e.stopPropagation();

          const { type, value } = e.detail;

          if (type === 'size') {
            const strokeWidth = value;
            for (const model of models) {
              ctx.std
                .get(EdgelessCRUDIdentifier)
                .updateElement(model.id, { strokeWidth });
            }
            return;
          }

          const strokeStyle = value;
          for (const model of models) {
            ctx.std
              .get(EdgelessCRUDIdentifier)
              .updateElement(model.id, { strokeStyle });
          }
        };

        return html`
          <edgeless-shape-color-picker
            @pickFillColor=${onPickFillColor}
            @pickStrokeColor=${onPickStrokeColor}
            @pickStrokeStyle=${onPickStrokeStyle}
            .payload=${{
              fillColor,
              strokeColor,
              strokeWidth,
              strokeStyle,
              originalFillColor,
              originalStrokeColor,
              theme,
              enableCustomColor,
            }}
          >
          </edgeless-shape-color-picker>
        `;
      },
    },
    {
      id: 'f.text',
      tooltip: 'Add text',
      tooltipWording: SHAPE_ADD_TEXT_TOOLTIP,
      icon: AddTextIcon(),
      when(ctx) {
        const models = ctx.getSurfaceModelsByType(ShapeElementModel);
        return models.length === 1 && !hasGrouped(models[0]) && !models[0].text;
      },
      run(ctx) {
        const model = ctx.getCurrentModelByType(ShapeElementModel);
        if (!model) return;

        const rootBlock = getRootBlock(ctx);
        if (!rootBlock) return;

        mountShapeTextEditor(model, rootBlock);
      },
    },
    {
      id: 'f1.edit-vertices',
      tooltip: 'Edit vertices',
      tooltipWording: SHAPE_EDIT_VERTICES_TOOLTIP,
      icon: EditIcon(),
      when(ctx) {
        const models = ctx.getSurfaceModelsByType(ShapeElementModel);
        return (
          models.length === 1 &&
          models[0].shapeType === ShapeType.Polygon &&
          !hasGrouped(models[0])
        );
      },
      run(ctx) {
        const model = ctx.getCurrentModelByType(ShapeElementModel);
        if (!model) return;

        const view = ctx.gfx.view.get(model.id);
        if (view instanceof ShapeElementView) {
          view.enterVertexEditingMode();
        }
      },
    },
    {
      id: 'f2.text-fit',
      when(ctx) {
        const models = ctx.getSurfaceModelsByType(ShapeElementModel);
        return (
          models.length > 0 &&
          models.every(model => !hasGrouped(model) && model.text)
        );
      },
      content(ctx) {
        const models = ctx.getSurfaceModelsByType(ShapeElementModel);
        if (!models.length) return null;

        const mode =
          getMostCommonValue(models, 'textFitMode') ?? TextFitMode.Grow;
        const next = nextTextFitMode(mode);
        const { icon, wording } = TEXT_FIT_UI[mode];
        const label = translateKey(ctx.std, ...wording);
        const nextLabel = translateKey(ctx.std, ...TEXT_FIT_UI[next].wording);

        return html`
          <editor-icon-button
            aria-label="${translateKey(ctx.std, ...SHAPE_TEXT_FIT_ARIA, {
              label,
            })}"
            .tooltip=${translateKey(ctx.std, ...SHAPE_TEXT_FIT_TOOLTIP, {
              label,
              nextLabel,
            })}
            @click=${() => applyTextFitMode(ctx.std, models, next)}
          >
            ${icon}
          </editor-icon-button>
        `;
      },
    },
    // id: `g.text`
    ...createTextActions(ShapeElementModel, 'shape', (ctx, model, props) => {
      // No need to adjust element bounds
      if (props['textAlign']) {
        ctx.std.get(EdgelessCRUDIdentifier).updateElement(model.id, props);
        return;
      }

      const xywh = normalizeShapeBound(
        model,
        Bound.fromXYWH(model.deserializedXYWH)
      ).serialize();

      ctx.std
        .get(EdgelessCRUDIdentifier)
        .updateElement(model.id, { ...props, xywh });
    }).map<ToolbarGenericAction>(action => ({
      ...action,
      id: `g.text-${action.id}`,
      when(ctx) {
        const models = ctx.getSurfaceModelsByType(ShapeElementModel);
        return (
          models.length > 0 &&
          models.every(model => !hasGrouped(model) && model.text)
        );
      },
    })),
  ],

  when: ctx => ctx.getSurfaceModelsByType(ShapeElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

// When the shape is filled with black color, the text color should be white.
// When the shape is transparent, the text color should be set according to the theme.
// Otherwise, the text color should be black.
function getTextColor(fillColor: Color, isNotTransparent = false) {
  if (isNotTransparent) {
    if (isEqual(fillColor, DefaultTheme.black)) {
      return DefaultTheme.white;
    } else if (isEqual(fillColor, DefaultTheme.white)) {
      return DefaultTheme.black;
    } else if (isEqual(fillColor, DefaultTheme.pureBlack)) {
      return DefaultTheme.pureWhite;
    } else if (isEqual(fillColor, DefaultTheme.pureWhite)) {
      return DefaultTheme.pureBlack;
    }
  }

  // aka `DefaultTheme.pureBlack`
  return DefaultTheme.shapeTextColor;
}

export function hasGrouped(model: ShapeElementModel) {
  return model.group instanceof MindmapElementModel;
}

export const shapeToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:shape'),
  config: shapeToolbarConfig,
});
