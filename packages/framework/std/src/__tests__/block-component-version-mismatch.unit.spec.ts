import {
  Container,
  createIdentifier,
  type ServiceProvider,
} from '@labre/global/di';
import { describe, expect, test } from 'vitest';

import type { BlockComponent as BlockComponentType } from '../view/element/block-component.js';
import { BlockComponent } from '../view/element/block-component.js';

/**
 * `renderVersionMismatch`'s translation seam (`block-component.ts`) reaches
 * the host's `TranslationProvider` WITHOUT `@labre/std` importing
 * `@labre/affine-shared` — the two packages are not allowed to depend on
 * each other. It does this by looking the service up under the same
 * `identifierName` string (`'AffineTranslationService'`) a completely
 * separate `createIdentifier` call declares, which is exactly what a host
 * wiring `@labre/affine-shared/services`' `TranslationExtension` does.
 *
 * This spec builds that "separate call" independently — its own
 * `createIdentifier`, never imported from `block-component.ts` — and proves
 * the card still finds the service registered under it, before falling back
 * to English when nothing is registered.
 */
describe('BlockComponent.renderVersionMismatch reaches a host translation provider by name', () => {
  interface FakeTranslationService {
    t(
      key: string,
      params?: Record<string, string | number>
    ): string | undefined;
  }

  // A SEPARATE identifier object from the one `block-component.ts` declares
  // internally — same name, different instance, exactly like a real host's
  // import of `TranslationProvider` from `@labre/affine-shared/services`.
  const HostTranslationProvider = createIdentifier<FakeTranslationService>(
    'AffineTranslationService'
  );

  function stdWith(service?: FakeTranslationService) {
    const container = new Container();
    if (service) container.addImpl(HostTranslationProvider, () => service);
    const provider = container.provider();
    return { getOptional: provider.getOptional.bind(provider) };
  }

  /** `renderVersionMismatch` only reads `this.std` and `this.model.flavour`. */
  function render(std: Pick<ServiceProvider, 'getOptional'>) {
    const self = {
      std,
      model: { flavour: 'affine:test-flavour' },
    } as unknown as BlockComponentType;
    return BlockComponent.prototype.renderVersionMismatch.call(self, 3, 1) as {
      strings: readonly string[];
      values: readonly unknown[];
    };
  }

  test('falls back to English with no provider registered', () => {
    const result = render(stdWith());
    expect(result.values).toContain('Block Version Mismatched');
    expect(result.values).toContain(
      'We can not render this affine:test-flavour block because the version is mismatched.'
    );
    expect(result.values).toContain('Editor version: 3');
    expect(result.values).toContain('Data version: 1');
  });

  test('resolves through a provider registered under the SAME name, a different identifier object', () => {
    const fr: Record<string, string> = {
      'com.labre.std.version-mismatch.title': 'Version de bloc incompatible',
      'com.labre.std.version-mismatch.body':
        "Impossible d'afficher ce bloc {{flavour}} : version incompatible.",
      'com.labre.std.version-mismatch.editor-version':
        "Version de l'éditeur : {{version}}",
      'com.labre.std.version-mismatch.data-version':
        'Version des données : {{version}}',
    };
    const result = render(stdWith({ t: key => fr[key] }));
    expect(result.values).toContain('Version de bloc incompatible');
    expect(result.values).toContain(
      "Impossible d'afficher ce bloc affine:test-flavour : version incompatible."
    );
    expect(result.values).toContain("Version de l'éditeur : 3");
    expect(result.values).toContain('Version des données : 1');
  });
});
