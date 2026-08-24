import { EdgelessCRUDIdentifier } from '@labre/affine-block-surface';
import {
  packColor,
  type PickColorEvent,
} from '@labre/affine-components/color-picker';
import type { LineDetailType } from '@labre/affine-components/edgeless-line-styles-panel';
import {
  createTextActions,
  normalizeTextBound,
} from '@labre/affine-gfx-text';
import {
  ConnectorElementModel,
  type ConnectorElementProps,
  type ConnectorLabelProps,
  ConnectorMode,
  DEFAULT_FRONT_ENDPOINT_STYLE,
  DEFAULT_REAR_ENDPOINT_STYLE,
  DefaultTheme,
  LineWidth,
  PointStyle,
  resolveColor,
  StrokeStyle,
} from '@labre/affine-model';
import {
  type ToolbarContext,
  type ToolbarGenericAction,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
} from '@labre/affine-shared/services';
import {
  getMostCommonResolvedValue,
  getMostCommonValue,
} from '@labre/affine-shared/utils';
import type { MenuItem } from '@labre/affine-widget-edgeless-toolbar';
import {
  getRootBlock,
  LINE_STYLE_LIST,
  renderMenu,
} from '@labre/affine-widget-edgeless-toolbar';
import { Bound } from '@labre/global/gfx';
import {
  AddTextIcon,
  ConnectorCIcon,
  ConnectorEIcon,
  ConnectorLIcon,
  EndPointArrowIcon,
  EndPointCircleIcon,
  EndPointDiamondIcon,
  EndPointTriangleIcon,
  FlipDirectionIcon,
  StartPointArrowIcon,
  StartPointCircleIcon,
  StartPointDiamondIcon,
  StartPointIcon,
  StartPointTriangleIcon,
} from '@blocksuite/icons/lit';
import {
  BlockFlavourIdentifier,
  getRegisteredCommands,
  runCommand,
} from '@labre/std';
import { html } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

import { isConnectorWithLabel } from '../connector-manager';
import { INVERT_EDGE_DIRECTION } from '../direction/invert-direction';
import {
  asTypedEdge,
  edgeIsBound,
  roleVocabularies,
} from '../direction/typed-edge';
import { mountConnectorLabelEditor } from '../text';

const FRONT_ENDPOINT_STYLE_LIST = [
  {
    value: PointStyle.None,
    icon: StartPointIcon(),
  },
  {
    value: PointStyle.Arrow,
    icon: StartPointArrowIcon(),
  },
  {
    value: PointStyle.Triangle,
    icon: StartPointTriangleIcon(),
  },
  {
    value: PointStyle.Circle,
    icon: StartPointCircleIcon(),
  },
  {
    value: PointStyle.Diamond,
    icon: StartPointDiamondIcon(),
  },
] as const satisfies MenuItem<PointStyle>[];

const REAR_ENDPOINT_STYLE_LIST = [
  {
    value: PointStyle.Diamond,
    icon: EndPointDiamondIcon(),
  },
  {
    value: PointStyle.Circle,
    icon: EndPointCircleIcon(),
  },
  {
    value: PointStyle.Triangle,
    icon: EndPointTriangleIcon(),
  },
  {
    value: PointStyle.Arrow,
    icon: EndPointArrowIcon(),
  },
  {
    value: PointStyle.None,
    icon: StartPointIcon(),
  },
] as const satisfies MenuItem<PointStyle>[];

const CONNECTOR_MODE_LIST = [
  {
    key: 'Curve',
    value: ConnectorMode.Curve,
    icon: ConnectorCIcon(),
  },
  {
    key: 'Elbowed',
    value: ConnectorMode.Orthogonal,
    icon: ConnectorEIcon(),
  },
  {
    key: 'Straight',
    value: ConnectorMode.Straight,
    icon: ConnectorLIcon(),
  },
] as const satisfies MenuItem<ConnectorMode>[];

export const connectorToolbarConfig = {
  actions: [
    {
      id: 'a.stroke-color',
      content(ctx) {
        const models = ctx.getSurfaceModelsByType(ConnectorElementModel);
        if (!models.length) return null;

        const enableCustomColor = ctx.features.getFlag('enable_color_picker');
        const theme = ctx.theme.edgeless$.value;

        const field = 'stroke';
        const firstModel = models[0];
        const strokeWidth =
          getMostCommonValue(models, 'strokeWidth') ?? LineWidth.Four;
        const strokeStyle =
          getMostCommonValue(models, 'strokeStyle') ?? StrokeStyle.Solid;
        const stroke =
          getMostCommonResolvedValue(models, field, stroke =>
            resolveColor(stroke, theme)
          ) ?? resolveColor(DefaultTheme.connectorColor, theme);

        const onPickColor = (e: PickColorEvent) => {
          switch (e.type) {
            case 'pick':
              {
                const color = e.detail.value;
                const props = packColor(field, color);
                const crud = ctx.std.get(EdgelessCRUDIdentifier);
                models.forEach(model => {
                  crud.updateElement(model.id, props);
                });
              }
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
              break;
          }
        };

        const onPickStrokeStyle = (e: CustomEvent<LineDetailType>) => {
          e.stopPropagation();

          const { type, value } = e.detail;

          if (type === 'size') {
            updateModelsWith(ctx, models, 'strokeWidth', value);
            return;
          }

          updateModelsWith(ctx, models, 'strokeStyle', value);
        };

        return html`
          <edgeless-color-picker-button
            class="stroke-color"
            .label="${'Stroke style'}"
            .pick=${onPickColor}
            .color=${stroke}
            .theme=${theme}
            .hollowCircle=${true}
            .originalColor=${firstModel.stroke}
            .enableCustomColor=${enableCustomColor}
          >
            <edgeless-line-styles-panel
              slot="other"
              style=${styleMap({
                display: 'flex',
                alignSelf: 'stretch',
                gap: '8px',
              })}
              @select=${onPickStrokeStyle}
              .lineSize=${strokeWidth}
              .lineStyle=${strokeStyle}
            ></edgeless-line-styles-panel>
            <editor-toolbar-separator
              slot="separator"
              data-orientation="horizontal"
            ></editor-toolbar-separator>
          </edgeless-color-picker-button>
        `;
      },
    },
    {
      id: 'b.style',
      when: ctx => ctx.features.getFlag('enable_edgeless_scribbled_style'),
      content(ctx) {
        const models = ctx.getSurfaceModelsByType(ConnectorElementModel);
        if (!models.length) return null;

        const field = 'rough';
        const rough = getMostCommonValue(models, field) ?? false;
        const onPick = (value: boolean) => {
          updateModelsWith(ctx, models, field, value);
        };

        return renderMenu({
          label: 'Style',
          items: LINE_STYLE_LIST,
          currentValue: rough,
          onPick,
        });
      },
    },
    {
      id: 'c.endpoint-style',
      actions: [
        {
          id: 'a.start-point-style',
          content(ctx) {
            const models = ctx.getSurfaceModelsByType(ConnectorElementModel);
            if (!models.length) return null;

            const field = 'frontEndpointStyle';
            const pointStyle =
              getMostCommonValue(models, field) ?? DEFAULT_FRONT_ENDPOINT_STYLE;
            const onPick = (value: PointStyle) => {
              updateModelsWith(ctx, models, field, value);
            };

            return renderMenu({
              label: 'Start point style',
              items: FRONT_ENDPOINT_STYLE_LIST,
              currentValue: pointStyle,
              onPick,
            });
          },
        },
        {
          id: 'b.flip-direction',
          icon: FlipDirectionIcon(),
          tooltip: 'Flip direction',
          /**
           * Hidden for a TYPED EDGE (`docs/adr/0010` M3).
           *
           * This entry swaps the two endpoint STYLES and does not touch
           * `source`/`target`. On a generalist connector that is honest — it is
           * an arrowhead menu. On an edge whose persisted direction is the
           * relation's orientation it would move the only visible sign of that
           * relation while leaving the relation intact: the picture and the
           * data would then disagree. Such an edge gets `d.invert-direction`
           * instead, which moves both.
           *
           * Not gated on any framework flag: the vocabulary that answers "is
           * this a typed edge" is registered by the always-on render extension,
           * so a Wardley link stays protected on a board whose Wardley tooling
           * is switched off.
           *
           * `some`, so a MIXED selection hides it too: one swap applied to
           * every selected connector would still lie about the typed one, and
           * `b.invert-direction` appears in its place and acts on that half.
           * A typed edge with a free end also keeps it hidden — the entry is
           * hidden by what the element IS, never by what it happens to bind.
           */
          when: ctx =>
            !ctx
              .getSurfaceModelsByType(ConnectorElementModel)
              .some(model =>
                asTypedEdge(roleVocabularies(ctx.std), model)
              ),
          run(ctx) {
            const models = ctx.getSurfaceModelsByType(ConnectorElementModel);
            if (!models.length) return;

            const frontEndpointStyle =
              getMostCommonValue(models, 'frontEndpointStyle') ??
              DEFAULT_FRONT_ENDPOINT_STYLE;
            const rearEndpointStyle =
              getMostCommonValue(models, 'rearEndpointStyle') ??
              DEFAULT_REAR_ENDPOINT_STYLE;

            if (frontEndpointStyle === rearEndpointStyle) return;

            for (const model of models) {
              ctx.std.get(EdgelessCRUDIdentifier).updateElement(model.id, {
                frontEndpointStyle: rearEndpointStyle,
                rearEndpointStyle: frontEndpointStyle,
              });
            }
          },
        },
        {
          id: 'c.end-point-style',
          content(ctx) {
            const models = ctx.getSurfaceModelsByType(ConnectorElementModel);
            if (!models.length) return null;

            const field = 'rearEndpointStyle';
            const pointStyle =
              getMostCommonValue(models, field) ?? DEFAULT_REAR_ENDPOINT_STYLE;
            const onPick = (value: PointStyle) => {
              updateModelsWith(ctx, models, field, value);
            };

            return renderMenu({
              label: 'End point style',
              items: REAR_ENDPOINT_STYLE_LIST,
              currentValue: pointStyle,
              onPick,
            });
          },
        },
        {
          /**
           * **Reverse direction** — M3 of `docs/adr/0010`, and the only
           * supported inversion of a typed edge.
           *
           * It sits where `b.flip-direction` would have been, appears only when
           * every selected connector is a typed edge, and runs the registered
           * command rather than a private copy of it — so the contextual
           * toolbar, the palette, Settings › Shortcuts and the agent all reach
           * the same behaviour and the same single telemetry emission.
           */
          id: 'b.invert-direction',
          icon: FlipDirectionIcon(),
          tooltip: 'Reverse direction',
          /**
           * Shown as soon as the selection holds ONE reversible typed edge, and
           * it then acts on the typed edges of that selection and on nothing
           * else — `invertibleEdges` is the same filter on both sides.
           *
           * `some`, not `every`, on purpose: a selection mixing a Wardley link
           * with a plain arrow used to show NEITHER this entry (not every model
           * is typed) nor `b.flip-direction` (some model is), so lassoing two
           * connectors silently took the direction affordance away. A partial
           * gesture that says what it did beats a menu that vanishes.
           */
          when: ctx =>
            ctx
              .getSurfaceModelsByType(ConnectorElementModel)
              .some(
                model =>
                  asTypedEdge(roleVocabularies(ctx.std), model) !== null &&
                  edgeIsBound(model)
              ),
          run(ctx) {
            const command = getRegisteredCommands(ctx.std).find(
              candidate => candidate.id === INVERT_EDGE_DIRECTION
            );
            if (!command) return;
            runCommand(ctx.std, command, {
              surface: 'contextual-toolbar',
              source: 'toolbar:general',
            });
          },
        },
        {
          id: 'd.connector-shape',
          content(ctx) {
            const models = ctx.getSurfaceModelsByType(ConnectorElementModel);
            if (!models.length) return null;

            const field = 'mode';
            const mode =
              getMostCommonValue(models, field) ?? ConnectorMode.Orthogonal;
            const onPick = (value: ConnectorMode) => {
              updateModelsWith(ctx, models, field, value);
            };

            return renderMenu({
              label: 'Shape',
              tooltip: 'Connector shape',
              items: CONNECTOR_MODE_LIST,
              currentValue: mode,
              onPick,
            });
          },
        },
      ],
    },
    {
      id: 'g.text',
      tooltip: 'Add text',
      icon: AddTextIcon(),
      when(ctx) {
        const models = ctx.getSurfaceModelsByType(ConnectorElementModel);
        return models.length === 1 && !models[0].text;
      },
      run(ctx) {
        const model = ctx.getCurrentModelByType(ConnectorElementModel);
        if (!model) return;

        const rootModel = ctx.store.root;
        if (!rootModel) return;

        const rootBlock = getRootBlock(ctx);
        if (!rootBlock) return;

        mountConnectorLabelEditor(model, rootBlock);
      },
    },
    // id: `g.text`
    ...createTextActions(
      ConnectorElementModel,
      'connector',
      (ctx, model, props) => {
        if (!isConnectorWithLabel(model)) return;

        const labelStyle = { ...model.labelStyle, ...props };

        // No need to adjust element bounds
        if (props['textAlign']) {
          ctx.std
            .get(EdgelessCRUDIdentifier)
            .updateElement(model.id, { labelStyle });
          return;
        }

        const { fontFamily, fontStyle, fontSize, fontWeight } = labelStyle;
        const {
          text,
          labelXYWH,
          labelConstraints: { hasMaxWidth, maxWidth },
        } = model;
        const prevBounds = Bound.fromXYWH(labelXYWH || [0, 0, 16, 16]);
        const center = prevBounds.center;
        const bounds = normalizeTextBound(
          {
            yText: text!,
            fontFamily,
            fontStyle,
            fontSize,
            fontWeight,
            hasMaxWidth,
            maxWidth,
          },
          prevBounds
        );
        bounds.center = center;

        ctx.std.get(EdgelessCRUDIdentifier).updateElement(model.id, {
          labelStyle,
          labelXYWH: bounds.toXYWH(),
        });
      },
      model => model.labelStyle,
      (model, type, _) => model[type]('labelStyle')
    ).map<ToolbarGenericAction>(action => ({
      ...action,
      id: `g.text-${action.id}`,
      when(ctx) {
        const models = ctx.getSurfaceModelsByType(ConnectorElementModel);
        return models.length > 0 && models.every(model => model.hasLabel());
      },
    })),
  ],

  when: ctx => ctx.getSurfaceModelsByType(ConnectorElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

function updateModelsWith<
  T extends keyof Omit<ConnectorElementProps, keyof ConnectorLabelProps>,
>(
  ctx: ToolbarContext,
  models: ConnectorElementModel[],
  field: T,
  value: ConnectorElementProps[T]
) {
  ctx.store.captureSync();

  for (const model of models) {
    ctx.std
      .get(EdgelessCRUDIdentifier)
      .updateElement(model.id, { [field]: value });
  }
}

export const connectorToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:connector'),
  config: connectorToolbarConfig,
});
