import { ImageIcon, TextIcon } from '@blocksuite/icons/lit';
import { SeniorToolExtension } from '@labre/affine-widget-edgeless-toolbar';
import { Bound } from '@labre/global/gfx';
import { html } from 'lit';

import { mediaRender, textRender } from './basket-elements';

export const mindMapSeniorTool = SeniorToolExtension(
  'mindMap',
  ({ block, toolbarContainer }) => {
    return {
      name: 'Mind Map',
      content: html`<edgeless-mindmap-tool-button
        .edgeless=${block}
        .toolbarContainer=${toolbarContainer}
        .variant=${'mindmap'}
      ></edgeless-mindmap-tool-button>`,
    };
  }
);

const slot = (icon: ReturnType<typeof TextIcon>, tooltip: string, onClick: () => void) =>
  html`<div
    style="width:100%;height:100%;display:flex;align-items:center;justify-content:center"
  >
    <edgeless-tool-icon-button .tooltip=${tooltip} @click=${onClick}>
      <span style="display:flex;width:24px;height:24px">${icon}</span>
    </edgeless-tool-icon-button>
  </div>`;

/**
 * Standalone "Text" tool. Promoted out of the former "Others" submenu: a single
 * tap inserts an editable text element at the viewport center. Reuses the
 * submenu's `textRender` action.
 */
export const textSeniorTool = SeniorToolExtension(
  'edgeless-text',
  ({ block, gfx }) => ({
    name: 'Text',
    content: slot(TextIcon(), 'Text', () => {
      const { centerX, centerY } = gfx.viewport;
      void textRender(new Bound(centerX - 50, centerY - 16, 100, 32), block);
    }),
  })
);

/**
 * Standalone "Add file" tool. Promoted out of the former "Others" submenu: a
 * single tap opens the file picker and inserts the image/attachment at the
 * viewport center. Reuses the submenu's `mediaRender` action.
 */
export const mediaSeniorTool = SeniorToolExtension(
  'edgeless-media',
  ({ block, gfx }) => ({
    name: 'Add file',
    content: slot(ImageIcon(), 'Add file', () => {
      const { centerX, centerY } = gfx.viewport;
      void mediaRender(new Bound(centerX - 50, centerY - 50, 100, 100), block);
    }),
  })
);
