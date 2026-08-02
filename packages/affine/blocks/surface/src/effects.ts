import {
  READING_PROPOSAL_WIDGET,
  ReadingProposalWidget,
} from './extensions/reading-widget.js';
import {
  VIOLATION_DETAIL_WIDGET,
  ViolationDetailWidget,
} from './extensions/violation-detail-widget.js';
import { SurfaceBlockComponent } from './surface-block.js';
import { SurfaceBlockVoidComponent } from './surface-block-void.js';

export function effects() {
  customElements.define('affine-surface-void', SurfaceBlockVoidComponent);
  customElements.define('affine-surface', SurfaceBlockComponent);
  customElements.define(VIOLATION_DETAIL_WIDGET, ViolationDetailWidget);
  customElements.define(READING_PROPOSAL_WIDGET, ReadingProposalWidget);
}
