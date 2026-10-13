import { NoteBlockModel } from '@labre/affine-model';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import {
  type BlockStdScope,
  PropTypes,
  requiredProperties,
  ShadowlessElement,
  stdContext,
} from '@labre/std';
import { consume } from '@lit/context';
import { html } from 'lit';
import { property } from 'lit/decorators.js';

import { NoteConfigExtension } from '../config';
import * as styles from './edgeless-page-block-title.css';

/**
 * The head of the page's note on the canvas: the host's title, if its
 * `NoteConfigExtension` draws one, then the title band (ADR 0035 §11). The
 * band sits inside the note's DOM so it follows the zoom like the rest of the
 * note (REQ-PR-7); it draws nothing when the host registers no
 * `TitleBandProvider`.
 */
@requiredProperties({
  note: PropTypes.instanceOf(NoteBlockModel),
})
export class EdgelessPageBlockTitle extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  override render() {
    if (!this.note.isPageBlock()) return;

    const title = this.std
      .getOptional(NoteConfigExtension.identifier)
      ?.pageBlockTitle({
        note: this.note,
        std: this.std,
      });

    return html`<div class=${styles.pageBlockTitle}>
      ${title}
      <labre-title-band
        .std=${this.std}
        .docId=${this.std.store.id}
        .surface=${'canvas'}
      ></labre-title-band>
    </div>`;
  }

  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  @property({ attribute: false })
  accessor note!: NoteBlockModel;
}
declare global {
  interface HTMLElementTagNameMap {
    'edgeless-page-block-title': EdgelessPageBlockTitle;
  }
}
