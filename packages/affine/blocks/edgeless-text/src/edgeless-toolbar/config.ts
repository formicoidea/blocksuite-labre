import { EdgelessCRUDIdentifier } from '@labre/affine-block-surface';
import { createTextActions } from '@labre/affine-gfx-text';
import { EdgelessTextBlockModel } from '@labre/affine-model';
import {
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
} from '@labre/affine-shared/services';
import { getMostCommonValue } from '@labre/affine-shared/utils';
import { Bound } from '@labre/global/gfx';
import { BlockFlavourIdentifier } from '@labre/std';
import { signal } from '@preact/signals-core';
import { html } from 'lit';

import { boundForScale, scaleFromSize, sizeFromScale } from './font-size.js';

const FONT_SIZE_LIST = [
  { value: 16 },
  { value: 24 },
  { value: 32 },
  { value: 40 },
  { value: 64 },
  { value: 128 },
] as const;

export const edgelessTextToolbarConfig = {
  // No need to adjust element bounds, which updates itself using ResizeObserver
  actions: [
    ...createTextActions(EdgelessTextBlockModel, 'edgeless-text'),
    {
      // The shared `d.font-size` action is disabled for edgeless text (the
      // model has no `fontSize` prop); this one drives `scale` instead, the
      // same prop ratio-locked corner resizing writes.
      id: 'd.text-size',
      content(ctx) {
        const models = ctx.getSurfaceModelsByType(EdgelessTextBlockModel);
        if (!models.length) return null;

        const size$ = signal(
          sizeFromScale(
            getMostCommonValue(
              models.map(model => model.props),
              'scale'
            ) ?? 1
          )
        );

        const onPick = (e: CustomEvent<number>) => {
          e.stopPropagation();

          const scale = scaleFromSize(e.detail);
          const crud = ctx.std.get(EdgelessCRUDIdentifier);

          for (const model of models) {
            const bound = boundForScale(
              Bound.deserialize(model.xywh),
              model.props.scale,
              scale
            );
            crud.updateElement(model.id, {
              scale,
              xywh: bound.serialize(),
            });
          }
        };

        return html`<affine-size-dropdown-menu
          @select=${onPick}
          .label="${'Font size'}"
          .sizes=${FONT_SIZE_LIST}
          .size$=${size$}
          .minSize=${1}
        ></affine-size-dropdown-menu>`;
      },
    },
  ],

  when: ctx => ctx.getSurfaceModelsByType(EdgelessTextBlockModel).length > 0,
} as const satisfies ToolbarModuleConfig;

export const edgelessTextToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:edgeless-text'),
  config: edgelessTextToolbarConfig,
});
