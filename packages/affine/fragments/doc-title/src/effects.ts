import { DocTitle } from './doc-title';
import { LABRE_TITLE_BAND, TitleBand } from './title-band/title-band.js';

export function effects() {
  customElements.define('doc-title', DocTitle);
  customElements.define(LABRE_TITLE_BAND, TitleBand);
}

declare global {
  interface HTMLElementTagNameMap {
    'doc-title': DocTitle;
    [LABRE_TITLE_BAND]: TitleBand;
  }
}
