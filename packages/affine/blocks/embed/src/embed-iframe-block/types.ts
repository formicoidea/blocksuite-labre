/**
 * The options for the embed iframe status card
 * layout: the layout of the card, horizontal or vertical
 * width: the width of the card, if not set, the card width will be 100%
 * height: the height of the card, if not set, the card height will be 100%
 * @example
 * {
 *   layout: 'horizontal',
 *   height: 114,
 * }
 */
export type EmbedIframeStatusCardOptions = {
  layout: 'horizontal' | 'vertical';
  width?: number;
  height?: number;
};

/**
 * An embed failure that names its own sentence — the `InterchangeImportError`
 * pattern (`blocks/surface/src/extensions/interchange.ts`) applied to the
 * iframe error card (#390).
 *
 * `message` stays the English developer sentence (the console, a test's
 * assertion); `messageKey` is what the CARD renders. An error without a key
 * renders `EMBED_IFRAME_ERROR_FALLBACK`, never its `message`: a sentence
 * written for a developer has no business under a translated title.
 */
export class EmbedIframeError extends Error {
  readonly messageKey?: string;

  constructor(message: string, options?: { messageKey?: string }) {
    super(message);
    this.name = 'EmbedIframeError';
    this.messageKey = options?.messageKey;
  }
}
