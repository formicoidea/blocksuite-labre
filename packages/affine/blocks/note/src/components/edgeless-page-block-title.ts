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
 * The head of the page's note on the canvas: the title, then the title band
 * (ADR 0035 §11). The band sits inside the note's DOM so it follows the zoom
 * like the rest of the note (REQ-PR-7); it draws nothing when the host
 * registers no `TitleBandProvider`.
 *
 * The title is the host's `NoteConfigExtension.pageBlockTitle` when it
 * registers one (`nothing` to draw none), else the document title itself.
 * Until 0.59 a host without that config got no title on the canvas at all:
 * the note was already wired for a `<doc-title>` (ArrowUp, the click routing
 * of `EdgelessNoteInteraction`, the band not drawn twice) but nothing put one
 * there. The fallback edits `root.props.title` like the page view's, behind
 * the same note mask as the note's content, so it is editable only once the
 * note is being edited, and never on a read-only store. Page mode never
 * mounts this element, so the page view's own title is not doubled.
 */
@requiredProperties({
  note: PropTypes.instanceOf(NoteBlockModel),
})
export class EdgelessPageBlockTitle extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  override render() {
    if (!this.note.isPageBlock()) return;

    const pageBlockTitle = this.std.getOptional(
      NoteConfigExtension.identifier
    )?.pageBlockTitle;
    const title = pageBlockTitle
      ? pageBlockTitle({ note: this.note, std: this.std })
      : html`<doc-title .doc=${this.note.store}></doc-title>`;

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
