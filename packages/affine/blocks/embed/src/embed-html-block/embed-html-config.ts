import { ConfigExtensionFactory } from '@labre/std';

export interface EmbedHtmlConfig {
  /**
   * A page the host serves to run the block's html instead of a `srcdoc`, which
   * inherits the Content-Security-Policy of the page (ADR 0047). The page posts
   * `{ type: 'labre:embed-html-ready' }` to its parent and writes the `html` of
   * the message it gets back. Its response must carry its own policy, with
   * `sandbox allow-scripts`: the host decides what that page may do.
   *
   * Absent, the block stays on `srcdoc`.
   */
  frameUrl?: string;
}

export const EmbedHtmlConfigExtension =
  ConfigExtensionFactory<EmbedHtmlConfig>('affine:embed-html');
