import { EdgelessCRUDIdentifier, TextUtils } from '@labre/affine-block-surface';
import {
  frameworkPaletteGroups,
  packColor,
  type PickColorEvent,
} from '@labre/affine-components/color-picker';
import { EditorChevronDown } from '@labre/affine-components/toolbar';
import {
  DefaultTheme,
  FontFamily,
  FontStyle,
  FontWeight,
  resolveColor,
  type SurfaceTextModelMap,
  TextAlign,
  type TextStyleProps,
} from '@labre/affine-model';
import {
  translateKey,
  type ToolbarActions,
  type ToolbarContext,
} from '@labre/affine-shared/services';
import {
  getMostCommonResolvedValue,
  getMostCommonValue,
} from '@labre/affine-shared/utils';
import {
  type MenuItem,
  renderMenu,
  resolveMenuItemLabel,
} from '@labre/affine-widget-edgeless-toolbar';
import {
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
} from '@blocksuite/icons/lit';
import type { GfxModel } from '@labre/std/gfx';
import { signal } from '@preact/signals-core';
import { html } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

import {
  isFontStyleSupported,
  isFontWeightSupported,
} from '../element-renderer/utils';
import {
  TEXT_ALIGN_CENTER,
  TEXT_ALIGN_LEFT,
  TEXT_ALIGN_RIGHT,
  TEXT_TOOLBAR_ALIGNMENT,
  TEXT_TOOLBAR_FONT,
  TEXT_TOOLBAR_FONT_STYLE,
  TEXT_TOOLBAR_FONT_STYLE_ITALIC,
  TEXT_TOOLBAR_FONT_WEIGHT_BOLD,
  TEXT_TOOLBAR_FONT_WEIGHT_LIGHT,
  TEXT_TOOLBAR_FONT_WEIGHT_REGULAR,
  TEXT_TOOLBAR_FONT_WEIGHT_SEMIBOLD,
  TEXT_TOOLBAR_FONT_SIZE,
  TEXT_TOOLBAR_TEXT_COLOR,
} from '../translations';

const FONT_WEIGHT_LIST = [
  {
    key: 'Light',
    keyWording: TEXT_TOOLBAR_FONT_WEIGHT_LIGHT,
    value: FontWeight.Light,
  },
  {
    key: 'Regular',
    keyWording: TEXT_TOOLBAR_FONT_WEIGHT_REGULAR,
    value: FontWeight.Regular,
  },
  {
    key: 'Semibold',
    keyWording: TEXT_TOOLBAR_FONT_WEIGHT_SEMIBOLD,
    value: FontWeight.SemiBold,
  },
  {
    key: 'Bold',
    keyWording: TEXT_TOOLBAR_FONT_WEIGHT_BOLD,
    value: FontWeight.Bold,
  },
] as const satisfies MenuItem<FontWeight>[];

const FONT_STYLE_LIST = [
  {
    value: FontStyle.Normal,
  },
  {
    key: 'Italic',
    keyWording: TEXT_TOOLBAR_FONT_STYLE_ITALIC,
    value: FontStyle.Italic,
  },
] as const satisfies MenuItem<FontStyle>[];

const FONT_SIZE_LIST = [
  { value: 16 },
  { value: 24 },
  { value: 32 },
  { value: 40 },
  { value: 64 },
  { value: 128 },
] as const satisfies MenuItem<number>[];

const TEXT_ALIGN_LIST = [
  {
    key: 'Left',
    keyWording: TEXT_ALIGN_LEFT,
    value: TextAlign.Left,
    icon: TextAlignLeftIcon(),
  },
  {
    key: 'Center',
    keyWording: TEXT_ALIGN_CENTER,
    value: TextAlign.Center,
    icon: TextAlignCenterIcon(),
  },
  {
    key: 'Right',
    keyWording: TEXT_ALIGN_RIGHT,
    value: TextAlign.Right,
    icon: TextAlignRightIcon(),
  },
] as const satisfies MenuItem<TextAlign>[];

/**
 * What the dropdowns read off a selected model. `fontSize` is optional because
 * `affine:edgeless-text` has no such prop — it scales instead, which is why the
 * `d.font-size` action skips that type.
 */
type ReadableTextStyleProps = Omit<TextStyleProps, 'fontSize'> &
  Partial<Pick<TextStyleProps, 'fontSize'>>;

export function createTextActions<
  K extends abstract new (...args: any) => any,
  T extends keyof SurfaceTextModelMap,
>(
  klass: K,
  type: T,
  update: (
    ctx: ToolbarContext,
    model: InstanceType<K>,
    props: Partial<TextStyleProps>
  ) => void = (ctx, model, props) =>
    ctx.std.get(EdgelessCRUDIdentifier).updateElement(model.id, props),
  mapInto: (model: InstanceType<K>) => ReadableTextStyleProps = model => model,
  stash: <P extends keyof TextStyleProps>(
    model: InstanceType<K>,
    type: 'stash' | 'pop',
    field: P
  ) => void = (model, type, field) => model[type](field)
) {
  return [
    {
      id: 'a.font',
      content(ctx) {
        const models = ctx.getSurfaceModelsByType(klass);
        if (!models.length) return null;
        const allowed = models.every(model =>
          isSurfaceTextModel(model, klass, type)
        );
        if (!allowed) return null;

        const mappedModels = models.map(mapInto);

        const fontFamily =
          getMostCommonValue(mappedModels, 'fontFamily') ?? FontFamily.Inter;
        const styleInfo = { fontFamily: TextUtils.wrapFontFamily(fontFamily) };

        const onPick = (fontFamily: FontFamily) => {
          let fontWeight =
            getMostCommonValue(mappedModels, 'fontWeight') ??
            FontWeight.Regular;
          let fontStyle =
            getMostCommonValue(mappedModels, 'fontStyle') ?? FontStyle.Normal;

          if (!isFontWeightSupported(fontFamily, fontWeight)) {
            fontWeight = FontWeight.Regular;
          }
          if (!isFontStyleSupported(fontFamily, fontStyle)) {
            fontStyle = FontStyle.Normal;
          }

          for (const model of models) {
            update(ctx, model, { fontFamily, fontWeight, fontStyle });
          }
        };

        return html`
          <editor-menu-button
            .contentPadding="${'8px'}"
            .button=${html`
              <editor-icon-button
                aria-label="${translateKey(ctx.std, ...TEXT_TOOLBAR_FONT)}"
                .tooltip="${translateKey(ctx.std, ...TEXT_TOOLBAR_FONT)}"
                .justify="${'space-between'}"
                .iconContainerWidth="${'40px'}"
              >
                <span class="label padding0" style=${styleMap(styleInfo)}
                  >Aa</span
                >
                ${EditorChevronDown}
              </editor-icon-button>
            `}
          >
            <edgeless-font-family-panel
              .value=${fontFamily}
              .onSelect=${onPick}
            ></edgeless-font-family-panel>
          </editor-menu-button>
        `;
      },
    },
    {
      id: 'b.text-color',
      content(ctx) {
        const models = ctx.getSurfaceModelsByType(klass);
        if (!models.length) return null;
        const allowed = models.every(model =>
          isSurfaceTextModel(model, klass, type)
        );
        if (!allowed) return null;

        const enableCustomColor = ctx.features.getFlag('enable_color_picker');
        const theme = ctx.theme.edgeless$.value;

        const palettes =
          type === 'shape'
            ? DefaultTheme.ShapeTextColorPalettes
            : DefaultTheme.Palettes;
        const defaultColor =
          type === 'shape'
            ? DefaultTheme.shapeTextColor
            : DefaultTheme.textColor;

        const mappedModels = models.map(mapInto);

        const field = 'color';
        const firstModel = mappedModels[0];
        const originalColor = firstModel[field];
        const color =
          getMostCommonResolvedValue(mappedModels, field, color =>
            resolveColor(color, theme)
          ) ?? resolveColor(defaultColor, theme);

        const onPick = (e: PickColorEvent) => {
          switch (e.type) {
            case 'pick':
              {
                const color = e.detail.value;
                const props = packColor(field, color);
                models.forEach(model => {
                  update(ctx, model, props);
                });
              }
              break;
            case 'start':
              ctx.store.captureSync();
              models.forEach(model => {
                stash(model, 'stash', field);
              });
              break;
            case 'end':
              ctx.store.transact(() => {
                models.forEach(model => {
                  stash(model, 'pop', field);
                });
              });
              break;
          }
        };

        // A label on a framework board opens on that framework's hues; the
        // text palette of the editor stays page one (`docs/adr/0027`).
        const carousel = frameworkPaletteGroups(ctx.std, models, palettes);

        return html`
          <edgeless-color-picker-button
            class="text-color"
            .label="${translateKey(ctx.std, ...TEXT_TOOLBAR_TEXT_COLOR)}"
            .pick=${onPick}
            .color=${color}
            .theme=${theme}
            .std=${ctx.std}
            .isText=${true}
            .hollowCircle=${true}
            .originalColor=${originalColor}
            .palettes=${palettes}
            .paletteGroups=${carousel.groups}
            .activeGroupKey=${carousel.activeKey}
            .enableCustomColor=${enableCustomColor}
          >
          </edgeless-color-picker-button>
        `;
      },
    },
    {
      id: 'c.font-style',
      content(ctx) {
        const models = ctx.getSurfaceModelsByType(klass);
        if (!models.length) return null;
        const allowed = models.every(model =>
          isSurfaceTextModel(model, klass, type)
        );
        if (!allowed) return null;

        const fontFamily =
          getMostCommonValue(models.map(mapInto), 'fontFamily') ??
          FontFamily.Inter;
        const fontWeight =
          getMostCommonValue(models.map(mapInto), 'fontWeight') ??
          FontWeight.Regular;
        const fontStyle =
          getMostCommonValue(models.map(mapInto), 'fontStyle') ??
          FontStyle.Normal;
        const matchFontFaces = TextUtils.getFontFacesByFontFamily(fontFamily);
        const disabled =
          matchFontFaces.length === 1 &&
          matchFontFaces[0].style === fontStyle &&
          matchFontFaces[0].weight === fontWeight;

        const onPick = (fontWeight: FontWeight, fontStyle: FontStyle) => {
          for (const model of models) {
            update(ctx, model, { fontWeight, fontStyle });
          }
        };

        return html`
          <editor-menu-button
            .contentPadding="${'8px'}"
            .button=${html`
              <editor-icon-button
                aria-label="${translateKey(
                  ctx.std,
                  ...TEXT_TOOLBAR_FONT_STYLE
                )}"
                .tooltip="${translateKey(ctx.std, ...TEXT_TOOLBAR_FONT_STYLE)}"
                .justify="${'space-between'}"
                .iconContainerWidth="${'90px'}"
                .disabled=${disabled}
              >
                <span class="label ellipsis">
                  ${resolveMenuItemLabel(FONT_WEIGHT_LIST, fontWeight, ctx.std)}
                  ${resolveMenuItemLabel(FONT_STYLE_LIST, fontStyle, ctx.std)}
                </span>
                ${EditorChevronDown}
              </editor-icon-button>
            `}
          >
            <edgeless-font-weight-and-style-panel
              .fontFamily=${fontFamily}
              .fontWeight=${fontWeight}
              .fontStyle=${fontStyle}
              .onSelect=${onPick}
              .std=${ctx.std}
            ></edgeless-font-weight-and-style-panel>
          </editor-menu-button>
        `;
      },
    },
    {
      id: 'd.font-size',
      when: type !== 'edgeless-text',
      content(ctx) {
        const models = ctx.getSurfaceModelsByType(klass);
        if (!models.length) return null;
        const allowed = models.every(model =>
          isSurfaceTextModel(model, klass, type)
        );
        if (!allowed) return null;

        const fontSize$ = signal(
          Math.trunc(
            getMostCommonValue(models.map(mapInto), 'fontSize') ??
              FONT_SIZE_LIST[0].value
          )
        );

        const onPick = (e: CustomEvent<number>) => {
          e.stopPropagation();

          const fontSize = e.detail;

          for (const model of models) {
            update(ctx, model, { fontSize });
          }
        };

        return html`<affine-size-dropdown-menu
          @select=${onPick}
          .label="${translateKey(ctx.std, ...TEXT_TOOLBAR_FONT_SIZE)}"
          .sizes=${FONT_SIZE_LIST}
          .size$=${fontSize$}
        ></affine-size-dropdown-menu>`;
      },
    },
    {
      id: 'e.alignment',
      content(ctx) {
        const models = ctx.getSurfaceModelsByType(klass);
        if (!models.length) return null;
        const allowed = models.every(model =>
          isSurfaceTextModel(model, klass, type)
        );
        if (!allowed) return null;

        const textAlign =
          getMostCommonValue(models.map(mapInto), 'textAlign') ??
          TextAlign.Left;

        const onPick = (textAlign: TextAlign) => {
          for (const model of models) {
            update(ctx, model, { textAlign });
          }
        };

        return renderMenu({
          label: 'Alignment',
          labelWording: TEXT_TOOLBAR_ALIGNMENT,
          items: TEXT_ALIGN_LIST,
          currentValue: textAlign,
          onPick,
          std: ctx.std,
        });
      },
    },
  ] as const satisfies ToolbarActions;
}

function isSurfaceTextModel<
  K extends abstract new (...args: any) => any,
  T extends keyof SurfaceTextModelMap,
>(model: GfxModel, klass: K, type: T): model is InstanceType<K> {
  return model instanceof klass || ('type' in model && model.type === type);
}
