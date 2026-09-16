import { DefaultTool } from '@labre/affine-block-surface';
import { menu } from '@labre/affine-components/context-menu';
import { TOOLBAR_FRAME, translateKey } from '@labre/affine-shared/services';
import type { DenseMenuBuilder } from '@labre/affine-widget-edgeless-toolbar';
import { FrameIcon } from '@blocksuite/icons/lit';

import { EdgelessFrameManagerIdentifier } from '../frame-manager.js';
import { FrameTool } from '../frame-tool';
import {
  FRAME_DENSE_MENU_CUSTOM,
  FRAME_DENSE_MENU_SLIDE,
} from '../translations.js';
import { FrameConfig } from './config.js';

export const buildFrameDenseMenu: DenseMenuBuilder = (edgeless, gfx) => {
  const { std } = edgeless;

  return menu.subMenu({
    name: translateKey(std, ...TOOLBAR_FRAME),
    prefix: FrameIcon({ width: '20px', height: '20px' }),
    select: () => gfx.tool.setTool(FrameTool),
    isSelected: gfx.tool.currentToolName$.peek() === 'frame',
    options: {
      items: [
        menu.action({
          name: translateKey(std, ...FRAME_DENSE_MENU_CUSTOM),
          select: () => gfx.tool.setTool(FrameTool),
        }),
        ...FrameConfig.map(config =>
          menu.action({
            name: translateKey(std, ...FRAME_DENSE_MENU_SLIDE, {
              name: config.name,
            }),
            select: () => {
              const frame = edgeless.std.get(EdgelessFrameManagerIdentifier);
              gfx.tool.setTool(DefaultTool);
              frame.createFrameOnViewportCenter(config.wh);
            },
          })
        ),
      ],
    },
  });
};
