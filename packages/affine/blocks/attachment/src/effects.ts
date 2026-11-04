import { registerHtmlFrame } from '@labre/affine-components/html-frame';

import { AttachmentBlockComponent } from './attachment-block';
import { AttachmentEdgelessBlockComponent } from './attachment-edgeless-block';
import { ATTACHMENT_HTML_VIEW_TAG, AttachmentHtmlView } from './html-view';

export function effects() {
  registerHtmlFrame();
  customElements.define(ATTACHMENT_HTML_VIEW_TAG, AttachmentHtmlView);
  customElements.define(
    'affine-edgeless-attachment',
    AttachmentEdgelessBlockComponent
  );
  customElements.define('affine-attachment', AttachmentBlockComponent);
}
