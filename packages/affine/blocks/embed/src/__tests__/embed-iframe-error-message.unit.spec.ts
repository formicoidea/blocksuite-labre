/**
 * **Would have caught #390 (4).** The iframe error card rendered
 * `this.error?.message || 'Failed to load embedded content'`: a sentence
 * written for a developer, drawn raw under a title that had been keyed, so a
 * French host showed a translated heading over an English body. Neither guard
 * could see it — the ratchet treats a `${…}` interpolation as opaque and does
 * not read a bare `new Error('…')` argument.
 *
 * The contract proved here: the card resolves an {@link EmbedIframeError}'s
 * own `messageKey` when there is one, and otherwise ONE keyed sentence. It
 * never displays `error.message`.
 */
import { BlockSuiteError, ErrorCode } from '@labre/global/exceptions';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, test } from 'vitest';

import { embedIframeErrorMessage } from '../embed-iframe-block/components/embed-iframe-error-card.js';
import { EmbedIframeError } from '../embed-iframe-block/types.js';
import {
  EMBED_IFRAME_ERROR_FALLBACK,
  EMBED_IFRAME_ERROR_INVALID_URL,
  EMBED_IFRAME_ERROR_NO_DATA,
} from '../translations.js';

/** No host: every `translateKey` falls through to its declared fallback. */
const NO_HOST = { getOptional: () => undefined } as unknown as BlockStdScope;

/** A host whose catalogue answers `entries` and nothing else. */
const hostWith = (entries: Record<string, string>): BlockStdScope =>
  ({
    getOptional: () => ({ t: (key: string) => entries[key] }),
  }) as unknown as BlockStdScope;

const FR = {
  [EMBED_IFRAME_ERROR_FALLBACK[0]]: 'Ce contenu intégré n’a pas pu être chargé',
  [EMBED_IFRAME_ERROR_NO_DATA[0]]:
    'Les données d’intégration sont introuvables',
  [EMBED_IFRAME_ERROR_INVALID_URL[0]]: 'URL d’intégration invalide',
};

describe('embedIframeErrorMessage', () => {
  test('an error that declares a key reads the host catalogue', () => {
    const noData = new EmbedIframeError(EMBED_IFRAME_ERROR_NO_DATA[1], {
      messageKey: EMBED_IFRAME_ERROR_NO_DATA[0],
    });
    expect(embedIframeErrorMessage(hostWith(FR), noData)).toBe(
      FR[EMBED_IFRAME_ERROR_NO_DATA[0]]
    );

    const invalidUrl = new EmbedIframeError(EMBED_IFRAME_ERROR_INVALID_URL[1], {
      messageKey: EMBED_IFRAME_ERROR_INVALID_URL[0],
    });
    expect(embedIframeErrorMessage(hostWith(FR), invalidUrl)).toBe(
      FR[EMBED_IFRAME_ERROR_INVALID_URL[0]]
    );
  });

  test('without a catalogue the English fallback is letter for letter what shipped', () => {
    const noData = new EmbedIframeError(EMBED_IFRAME_ERROR_NO_DATA[1], {
      messageKey: EMBED_IFRAME_ERROR_NO_DATA[0],
    });
    expect(embedIframeErrorMessage(NO_HOST, noData)).toBe(
      'Failed to get embed data'
    );
    expect(embedIframeErrorMessage(NO_HOST, null)).toBe(
      'Failed to load embedded content'
    );
  });

  test('a developer sentence never reaches the card', () => {
    // The DI wiring failure: an `EmbedIframeError` with NO key.
    const wiring = new EmbedIframeError(
      'EmbedIframeService or LinkPreviewService not found'
    );
    // Any other throw the block's `refreshData` could let through.
    const foreign = new BlockSuiteError(ErrorCode.ValueNotExists, 'boom');
    const plain = new Error('TypeError: cannot read properties of undefined');

    for (const error of [wiring, foreign, plain]) {
      const shown = embedIframeErrorMessage(hostWith(FR), error);
      expect(shown).toBe(FR[EMBED_IFRAME_ERROR_FALLBACK[0]]);
      expect(shown).not.toContain(error.message);
    }
  });
});
