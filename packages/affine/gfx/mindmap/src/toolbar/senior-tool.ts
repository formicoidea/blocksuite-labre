import { SeniorToolExtension } from '@labre/affine-widget-edgeless-toolbar';
import { Bound } from '@labre/global/gfx';
import { html, type TemplateResult } from 'lit';

import { mediaRender, textRender } from './basket-elements';
import { mindmapMenuMediaIcon, textIcon } from './icons';

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

// Reuse the (nicely drawn) icons from the former "Others" submenu, with a
// playful resting tilt that pops upright + scales on hover — echoing the old
// basket hover animation.
const slot = (icon: TemplateResult, tooltip: string, onClick: () => void) =>
  html`<style>
      .promoted-tool {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .promoted-tool .promoted-tool-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        /* Scale the drawn icons up so they read at the same size as the
         * neighbouring pen/shape icons (their natural SVG size is smaller). */
        transform: rotate(-4deg) scale(1.4);
        transition: transform 0.24s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .promoted-tool:hover .promoted-tool-icon {
        transform: rotate(0deg) scale(1.65);
      }
      .promoted-tool .promoted-tool-icon svg {
        width: auto;
        height: auto;
        max-width: 52px;
        max-height: 44px;
      }
    </style>
    <div class="promoted-tool">
      <edgeless-tool-icon-button .tooltip=${tooltip} @click=${onClick}>
        <span class="promoted-tool-icon">${icon}</span>
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
    content: slot(textIcon, 'Text', () => {
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
    content: slot(mindmapMenuMediaIcon, 'Add file', () => {
      const { centerX, centerY } = gfx.viewport;
      void mediaRender(new Bound(centerX - 50, centerY - 50, 100, 100), block);
    }),
  })
);
