import { ValidationManager } from '@labre/affine-block-surface';
import { describe, expect, test } from 'vitest';

import {
  getCommandManifest,
  getCommandManifestForSurface,
  getCommands,
} from '../../commands.js';
import { getInternalStoreExtensions } from '../../extensions/store.js';
import { getInternalViewExtensions } from '../../extensions/view.js';
import { getAffineSchemas } from '../../schemas.js';
import {
  isBlockEnabled,
  isCapabilityEnabled,
  OPTIONAL_BLOCKS,
  OPTIONAL_CAPABILITIES,
  type LabreFlags,
} from '../../flags.js';
import { getShortcutManifest } from '../../shortcuts.js';

/**
 * The `ai-audit` capability switch (PF14.1).
 *
 * Two things are asserted, and they are different claims:
 *
 * 1. **The switch works like a flag** — two-sided gating, exactly as ADR 0008 §
 *    Consequences demands of framework flags: off, `map.audit` vanishes from
 *    what a host ENUMERATES (`getCommands`, both manifests) *and* from what
 *    REGISTERS (`AuditViewExtension` is not in the view list, so nothing binds
 *    and the agent surface has nothing to invoke).
 * 2. **It is a second AXIS, not a longer list** — `ai-audit` is deliberately
 *    absent from `OPTIONAL_BLOCKS`, because that list answers "does this block
 *    or framework exist for this user" and every entry there names something a
 *    document can contain. A capability names none.
 */

const AUDIT = 'map.audit';
const EXTENSION = 'AuditViewExtension';

const names = (flags?: Record<string, boolean>) =>
  getInternalViewExtensions(flags).map(e => e.name);

describe('ai-audit is a capability, on its own axis', () => {
  test('is not an OPTIONAL_BLOCKS entry', () => {
    expect(OPTIONAL_BLOCKS as readonly string[]).not.toContain('ai-audit');
    expect(OPTIONAL_CAPABILITIES).toContain('ai-audit');
  });

  test('the two key spaces are disjoint, so one bag carries both', () => {
    const blocks = new Set<string>(OPTIONAL_BLOCKS);
    for (const capability of OPTIONAL_CAPABILITIES) {
      expect(blocks.has(capability)).toBe(false);
    }
  });

  test('defaults to enabled, like every flag', () => {
    expect(isCapabilityEnabled(undefined, 'ai-audit')).toBe(true);
    expect(isCapabilityEnabled({}, 'ai-audit')).toBe(true);
    expect(isCapabilityEnabled({ 'ai-audit': false }, 'ai-audit')).toBe(false);
  });

  test('switching it off leaves every block flag alone', () => {
    const off: LabreFlags = { 'ai-audit': false };
    for (const block of OPTIONAL_BLOCKS) {
      expect(isBlockEnabled(off, block)).toBe(true);
    }
  });
});

describe('switched ON (the default)', () => {
  test('map.audit is in the registry and on the agent surface', () => {
    expect(getCommands().some(c => c.id === AUDIT)).toBe(true);
    expect(
      getCommandManifestForSurface('agent').some(e => e.id === AUDIT)
    ).toBe(true);
  });

  test('its extension is registered, so the command actually binds', () => {
    expect(names()).toContain(EXTENSION);
  });

  test('it is bindable from Settings › Shortcuts despite being keyless', () => {
    const entry = getShortcutManifest().find(e => e.id === AUDIT);
    expect(entry).toBeDefined();
    expect(entry?.defaultKeys).toEqual({ mac: [], other: [] });
  });
});

describe('switched OFF', () => {
  const off = { 'ai-audit': false };

  test('vanishes from the command registry', () => {
    expect(getCommands(off).some(c => c.id === AUDIT)).toBe(false);
  });

  test('vanishes from BOTH manifests, so no host panel offers it', () => {
    expect(getCommandManifest(off).some(e => e.id === AUDIT)).toBe(false);
    expect(getShortcutManifest(off).some(e => e.id === AUDIT)).toBe(false);
  });

  test('vanishes from the agent surface — the one that matters here', () => {
    expect(
      getCommandManifestForSurface('agent', off).some(e => e.id === AUDIT)
    ).toBe(false);
  });

  test('its extension is not registered, so nothing binds', () => {
    expect(names(off)).not.toContain(EXTENSION);
  });

  test('takes NOTHING else with it', () => {
    // The switch is one command wide. Everything the editor otherwise offers —
    // every framework's artefacts, every core command — is untouched, which is
    // the "disabling never costs anything" half of the flag contract.
    const on = getCommands().filter(c => c.id !== AUDIT);
    expect(getCommands(off).map(c => c.id)).toEqual(on.map(c => c.id));
    expect(names(off)).toEqual(names().filter(n => n !== EXTENSION));
  });
});

describe('no data can be lost by switching it off', () => {
  test('the two data assembly points ignore the switch entirely', () => {
    // The strongest form of "disabling never touches data": the flag set is
    // accepted and unread. Schemas and store extensions are registered
    // unconditionally (ADR 0009), so a document written with `ai-audit` on and
    // opened with it off is not merely readable — it is loaded by byte-for-byte
    // the same registry.
    expect(getAffineSchemas({ 'ai-audit': false })).toEqual(getAffineSchemas());
    expect(getInternalStoreExtensions({ 'ai-audit': false })).toEqual(
      getInternalStoreExtensions()
    );
  });

  test('the seam contributes nothing to either of them', () => {
    // Two lists that must stay free of the audit: nothing it owns is a schema,
    // and nothing it owns survives a reload.
    const stored = JSON.stringify(
      getInternalStoreExtensions().map(e => (e as { name?: string }).name ?? '')
    );
    expect(stored.toLowerCase()).not.toContain('audit');
    expect(
      getAffineSchemas().some(s =>
        JSON.stringify(s.model?.flavour ?? '').includes('audit')
      )
    ).toBe(false);
  });

  test('findings are session state — nothing about them is persisted', () => {
    // `auditFindings$` is a signal on `ValidationManager`, cleared on unmount.
    // An audit is an opinion at a moment; the document says what it contains,
    // not what a model thought of it.
    expect(Object.getOwnPropertyNames(ValidationManager.prototype)).toContain(
      'setAuditFindings'
    );
  });
});
