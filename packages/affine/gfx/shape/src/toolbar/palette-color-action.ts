import { EdgelessCRUDIdentifier } from '@labre/affine-block-surface';
import {
  packColor,
  type PickColorEvent,
} from '@labre/affine-components/color-picker';
import {
  type Color,
  DefaultTheme,
  isTransparent,
  LineWidth,
  type Palette,
  resolveColor,
  ShapeElementModel,
  StrokeStyle,
} from '@labre/affine-model';
import type {
  ToolbarAction,
  ToolbarContext,
} from '@labre/affine-shared/services';
import { getMostCommonValue } from '@labre/affine-shared/utils';
import { html } from 'lit';

/**
 * The neutrals of the default editor palette: greys, white, black, transparent.
 *
 * A framework that seeds the picker with its OWN swatches drops the historical
 * editor colours — they say nothing in that notation — but keeps the neutrals,
 * which every drawing needs and no notation owns.
 */
const NEUTRAL_KEY = /grey|gray|white|black|transparent/i;

export function neutralPalettes(): Palette[] {
  return DefaultTheme.Palettes.filter(p => NEUTRAL_KEY.test(p.key));
}

// Mirror of the shape color action's text-color rule.
function getTextColor(fillColor: Color) {
  if (fillColor === DefaultTheme.black) return DefaultTheme.white;
  if (fillColor === DefaultTheme.white) return DefaultTheme.black;
  return DefaultTheme.shapeTextColor;
}

/**
 * A fill / stroke colour picker identical to the shape one, seeded with the
 * caller's swatches (`.palettes`) instead of the default editor palette.
 *
 * Frameworks whose nodes are {@link ShapeElementModel} subclasses (EDGY,
 * Wardley, …) all want the same picker with their own colours in front of it,
 * so the ~100 lines that wire `edgeless-shape-color-picker` to the models live
 * here once rather than being copied per framework.
 */
/**
 * The last word on what a picked swatch actually WRITES as a model's fill.
 *
 * The identity by default, which is what a colour picker means everywhere. It
 * exists because a swatch is a hue and some elements are washes: a Wardley
 * ZONE is drawn over the map it groups, so its fill carries an alpha, and a
 * picked swatch that replaced `#c6dbfc99` with an opaque `#5b9cf6` would hide
 * the very map the zone is there to annotate. A framework that has such
 * elements says so here — per model, because the same picker serves its
 * washes and its opaque artefacts.
 */
export type FillColorFor = (model: ShapeElementModel, value: Color) => Color;

export function paletteColorAction(
  id: string,
  palettes: Palette[],
  fillColorFor: FillColorFor = (_model, value) => value
): ToolbarAction {
  return {
    id,
    when(ctx: ToolbarContext) {
      return ctx.getSurfaceModelsByType(ShapeElementModel).length > 0;
    },
    content(ctx: ToolbarContext) {
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
              models.forEach(model => model.stash(field));
              break;
            case 'end':
              ctx.store.transact(() => {
                models.forEach(model => model.pop(field));
              });
          }
        };

      const onPickFillColor = pickColorWrapper('fillColor', palette => {
        const value = palette.value;
        const filled = isTransparent(value);
        const crud = ctx.std.get(EdgelessCRUDIdentifier);
        models.forEach(model => {
          // Per model, so a selection mixing a wash and an opaque artefact
          // gets the right fill on each — and `packColor` runs on what the
          // hook returned, since that is the value the document stores.
          const props = packColor('fillColor', fillColorFor(model, value));
          if (filled && !model.filled) {
            const color = getTextColor(value);
            Object.assign(props, { filled, color });
          }
          crud.updateElement(model.id, props);
        });
      });

      const onPickStrokeColor = pickColorWrapper('strokeColor', palette => {
        const props = packColor('strokeColor', palette.value);
        const crud = ctx.std.get(EdgelessCRUDIdentifier);
        models.forEach(model => crud.updateElement(model.id, props));
      });

      const onPickStrokeStyle = (
        e: CustomEvent<{ type: string; value: number & StrokeStyle }>
      ) => {
        e.stopPropagation();
        const { type, value } = e.detail;
        const crud = ctx.std.get(EdgelessCRUDIdentifier);
        const props =
          type === 'size'
            ? { strokeWidth: value as number }
            : { strokeStyle: value as StrokeStyle };
        for (const model of models) {
          crud.updateElement(model.id, props);
        }
      };

      return html`
        <edgeless-shape-color-picker
          @pickFillColor=${onPickFillColor}
          @pickStrokeColor=${onPickStrokeColor}
          @pickStrokeStyle=${onPickStrokeStyle}
          .palettes=${palettes}
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
  };
}
