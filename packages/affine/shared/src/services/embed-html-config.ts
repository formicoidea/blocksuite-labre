import { ConfigExtensionFactory } from '@labre/std';

export interface EmbedHtmlConfig {
  /**
   * A page the host serves to run html instead of a `srcdoc`, which inherits the
   * Content-Security-Policy of the page (ADR 0047). The page posts
   * `{ type: 'labre:embed-html-ready' }` to its parent and receives
   * `{ html, scripts, scroll }`. Run scripts only on an explicit `scripts: true`. It
   * runs under `HOST_PAGE_SANDBOX` and must hand the html to a frame it isolates
   * itself, never write it: that frame's response carries `sandbox allow-scripts`.
   *
   * Absent, the html block stays on `srcdoc` and an html attachment stays a card
   * (ADR 0048).
   */
  frameUrl?: string;
}

export const EmbedHtmlConfigExtension =
  ConfigExtensionFactory<EmbedHtmlConfig>('affine:embed-html');
