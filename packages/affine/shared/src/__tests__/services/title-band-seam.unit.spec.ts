import { Container } from '@labre/global/di';
import { signal } from '@preact/signals-core';
import { describe, expect, it, vi } from 'vitest';

import {
  TitleBandExtension,
  TitleBandProvider,
  type TitleBandService,
} from '../../services/title-band-service.js';

/**
 * The title band seam has no default (ADR 0035 §9d): absent, `getOptional`
 * answers nothing and the band draws nothing at all, under the title and in
 * the note header. A default registered by the library would draw an empty
 * band in every host that has no properties, the playground and labre-mcp
 * included. The band's own behaviour without a provider is held by
 * `fragments/doc-title/src/__tests__/title-band.unit.spec.ts`.
 */

function resolve(extensions: { setup: (di: Container) => void }[]) {
  const container = new Container();
  for (const extension of extensions) extension.setup(container);
  return container.provider().getOptional(TitleBandProvider);
}

function service(): TitleBandService {
  return {
    sheet$: () => signal({ status: 'missing' }),
    set: vi.fn(async () => {}),
  };
}

describe('TitleBandExtension', () => {
  it('answers nothing when the host registers no title band', () => {
    expect(resolve([])).toBeFalsy();
  });

  it("answers the host's service, and a later registration wins", () => {
    const first = service();
    const second = service();
    expect(resolve([TitleBandExtension(first)])).toBe(first);
    expect(
      resolve([TitleBandExtension(first), TitleBandExtension(second)])
    ).toBe(second);
  });
});
