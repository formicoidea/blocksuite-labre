import { FRAMEWORK_IDS } from '@labre/std';
import { describe, expect, test } from 'vitest';

import { getCommandManifest, getCommands } from '../../commands.js';
import { getInternalViewExtensions } from '../../extensions/view.js';
import { FRAMEWORK_DESCRIPTORS } from '../../frameworks.js';
import { getShortcutManifest } from '../../shortcuts.js';

/**
 * Flag gating has TWO sides and both must agree (ADR 0008 § Consequences):
 *
 * - READ time: `getCommands` / `getShortcutManifest` / `getCommandManifest`
 *   filter on `isBlockEnabled`, so a host panel enumerated off-editor sees
 *   nothing.
 * - REGISTRATION time: `CommandExtension(...)` lives inside each framework's
 *   flag-gated tooling extension, so nothing binds and the sub-menu — which
 *   renders from the registry — has nothing to draw.
 *
 * A framework toggled off must vanish from all three at once.
 */
describe.each(FRAMEWORK_IDS)('%s toggled off', id => {
  const off = { [id]: false };
  const descriptor = FRAMEWORK_DESCRIPTORS.find(d => d.id === id)!;
  const gatedExtension = descriptor.extensions.find(e => e.flag === id)!
    .viewExtension;

  test('disappears from the command registry', () => {
    expect(getCommands(off).some(c => c.owner === id)).toBe(false);
    expect(getCommands().some(c => c.owner === id)).toBe(true);
  });

  test('disappears from both manifests', () => {
    expect(getShortcutManifest(off).some(e => e.owner === id)).toBe(false);
    expect(getCommandManifest(off).some(e => e.owner === id)).toBe(false);
  });

  test('its tooling extension is not registered, so nothing binds or renders', () => {
    const names = (flags?: Record<string, boolean>) =>
      getInternalViewExtensions(flags).map(e => e.name);
    expect(names(off)).not.toContain(gatedExtension);
    expect(names()).toContain(gatedExtension);
  });

  test('its RENDER extension stays registered — placed elements keep painting', () => {
    // ADR 0009: a flag never decides whether stored content can be read.
    const renderer = descriptor.extensions.find(e => !e.flag);
    if (!renderer) return;
    expect(
      getInternalViewExtensions(off).map(e => e.name)
    ).toContain(renderer.viewExtension);
  });
});
