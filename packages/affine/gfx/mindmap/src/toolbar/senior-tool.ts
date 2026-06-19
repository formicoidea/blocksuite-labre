import { SeniorToolExtension } from '@labre/affine-widget-edgeless-toolbar';
import { html } from 'lit';

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

/** The "Others" button: free-text + add-file (mindmap moved to its own tool). */
export const otherSeniorTool = SeniorToolExtension(
  'other',
  ({ block, toolbarContainer }) => {
    return {
      name: 'Others',
      content: html`<edgeless-mindmap-tool-button
        .edgeless=${block}
        .toolbarContainer=${toolbarContainer}
        .variant=${'other'}
      ></edgeless-mindmap-tool-button>`,
    };
  }
);
