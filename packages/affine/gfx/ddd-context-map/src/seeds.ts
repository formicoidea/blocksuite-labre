import type { ChromeWording } from '@labre/affine-shared/services';

/**
 * The seeds baked into a placed artefact: the bounded-context bubble's
 * default caption, and the general-purpose cloud's. The nine relationship
 * patterns carry no seed of their own — since WS2 the palette ARMS the
 * connector tool rather than dropping a labelled group, so no word is
 * written into the document for them any more
 * (`activateContextMapRelationship`).
 *
 * Their own module, editor-free, so the toolbox (`toolbox.ts`,
 * `docs/adr/0045`) seeds a host's bubble and cloud with the same English
 * words; `commands.ts` re-exports them unchanged and resolves them through the
 * host's catalogue at placement (ADR 0023).
 */
export const CONTEXT_MAP_SEED_BOUNDED_CONTEXT: ChromeWording = [
  'com.labre.ddd-context-map.seed.bounded-context',
  'Bounded Context',
];
export const CONTEXT_MAP_SEED_CLOUD: ChromeWording = [
  'com.labre.ddd-context-map.seed.cloud',
  'System',
];
