/**
 * Who decides whether a code block shows line numbers — upstream #15381.
 *
 * There used to be one answer per block and no way to say "never" once and for
 * all. Now the host carries a global preference, the block keeps its own
 * override, and the embedder's feature flag still overrules both.
 */
import { describe, expect, it } from 'vitest';

import {
  CODE_BLOCK_LINE_NUMBERS_SETTING_KEY,
  readGlobalLineNumbers,
  resolveShowLineNumbers,
} from '../line-numbers.js';

describe('readGlobalLineNumbers', () => {
  it('shows line numbers when the host injects no setting service', () => {
    expect(readGlobalLineNumbers(undefined)).toBe(true);
  });

  it('shows line numbers when the host says nothing about code blocks', () => {
    expect(readGlobalLineNumbers({ edgelessScrollZoom: true })).toBe(true);
  });

  it('follows the host once it does say', () => {
    expect(
      readGlobalLineNumbers({ [CODE_BLOCK_LINE_NUMBERS_SETTING_KEY]: false })
    ).toBe(false);
    expect(
      readGlobalLineNumbers({ [CODE_BLOCK_LINE_NUMBERS_SETTING_KEY]: true })
    ).toBe(true);
  });
});

describe('resolveShowLineNumbers', () => {
  it('follows the global default while the block has no opinion', () => {
    expect(
      resolveShowLineNumbers({
        featureEnabled: true,
        blockOverride: undefined,
        globalDefault: false,
      })
    ).toBe(false);
    expect(
      resolveShowLineNumbers({
        featureEnabled: true,
        blockOverride: undefined,
        globalDefault: true,
      })
    ).toBe(true);
  });

  it('lets one block overrule the global default in either direction', () => {
    expect(
      resolveShowLineNumbers({
        featureEnabled: true,
        blockOverride: true,
        globalDefault: false,
      })
    ).toBe(true);
    expect(
      resolveShowLineNumbers({
        featureEnabled: true,
        blockOverride: false,
        globalDefault: true,
      })
    ).toBe(false);
  });

  it('keeps the embedder flag above both', () => {
    expect(
      resolveShowLineNumbers({
        featureEnabled: false,
        blockOverride: true,
        globalDefault: true,
      })
    ).toBe(false);
  });
});
