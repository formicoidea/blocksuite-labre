import { RESERVED_EDGELESS_KEYS } from '@labre/affine-block-root';
import { wardleyCommands } from '@labre/affine-gfx-wardley';
import {
  canonicalCombo,
  FRAMEWORK_IDS,
  type CommandDescriptor,
  type FrameworkId,
} from '@labre/std';
import { describe, expect, test } from 'vitest';

import { getCommandManifest, getCommands } from '../../commands.js';
import { FRAMEWORK_DESCRIPTORS } from '../../frameworks.js';

/**
 * The invariants ADR 0008 asks to be enforced by unit tests rather than by
 * design review. Every one of them was tribal knowledge before.
 */
const commands = getCommands();
const byOwner = (owner: string) => commands.filter(c => c.owner === owner);
const chordsOf = (c: CommandDescriptor) => c.defaultKeys.other;

describe('command registry invariants', () => {
  /**
   * The converted inventory, spelled out so a framework silently losing (or
   * gaining) an artefact shows up in review rather than in production.
   */
  test('every framework contributes its whole toolbox', () => {
    const counts = Object.fromEntries(
      [...FRAMEWORK_IDS, 'core'].map(owner => [owner, byOwner(owner).length])
    );
    expect(counts).toEqual({
      wardley: 13,
      edgy: 7,
      'cynefin-estuarine': 3,
      bpmn: 6,
      'ddd-event-storming': 9,
      'ddd-core-domain': 10,
      'ddd-context-map': 12,
      // 5 root commands (undo, redo, redo-windows, duplicate, applyLastStyle)
      // + shape.cycleTextFit + pivot.bind
      core: 7,
    });
    expect(commands).toHaveLength(67);
  });

  test('ids are unique', () => {
    const ids = commands.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('a framework id prefixes its commands; core is exempt', () => {
    for (const c of commands) {
      if (c.owner === 'core') continue;
      expect(FRAMEWORK_IDS).toContain(c.owner);
      expect(c.id.startsWith(`${c.owner}.`), c.id).toBe(true);
    }
  });

  /** The one numeric cap, and it is a UI one: 14 slots in the sub-menu. */
  test('no owner exceeds 14 senior-menu slots', () => {
    for (const id of FRAMEWORK_IDS) {
      const slots = byOwner(id).filter(c =>
        c.surfaces.includes('senior-menu')
      );
      expect(slots.length, `${id} sub-menu`).toBeLessThanOrEqual(14);
    }
  });

  test('every chord uses its framework’s prefix, with unique second keys', () => {
    for (const descriptor of FRAMEWORK_DESCRIPTORS) {
      const chords = byOwner(descriptor.id)
        .map(chordsOf)
        .filter(keys => keys.length > 0);
      if (!chords.length) continue;
      expect(
        descriptor.chordPrefix,
        `${descriptor.id} has chords but no allocated prefix`
      ).toBeTruthy();
      expect(chords.every(keys => keys[0] === descriptor.chordPrefix)).toBe(
        true
      );
      const seconds = chords.map(keys => keys.slice(1).join(' '));
      expect(new Set(seconds).size).toBe(seconds.length);
    }
  });

  test('chord prefixes are unique and never shadow an imperative edgeless key', () => {
    const prefixes = FRAMEWORK_DESCRIPTORS.map(d => d.chordPrefix).filter(
      (p): p is string => !!p
    );
    expect(new Set(prefixes).size).toBe(prefixes.length);
    const reserved = new Set(
      RESERVED_EDGELESS_KEYS.map(k => canonicalCombo([k]))
    );
    for (const prefix of prefixes) {
      expect(reserved.has(canonicalCombo([prefix])), prefix).toBe(false);
    }
  });

  test('every framework has a descriptor and every descriptor a framework', () => {
    expect(FRAMEWORK_DESCRIPTORS.map(d => d.id).sort()).toEqual(
      [...FRAMEWORK_IDS].sort()
    );
  });

  test('the historical PostHog values are the ones declared', () => {
    // Renaming any of these silently breaks a live dashboard.
    const wire = Object.fromEntries(
      FRAMEWORK_DESCRIPTORS.map(d => [d.id, d.telemetryKey])
    );
    expect(wire).toEqual({
      wardley: 'wardley',
      edgy: 'edgy',
      'cynefin-estuarine': 'cynefin',
      bpmn: 'bpmn',
      'ddd-event-storming': 'event-storming',
      'ddd-core-domain': 'core-domain',
      'ddd-context-map': 'context-map',
    });
  });
});

describe('the serializable catalogue projection', () => {
  test('carries no function and no template across the seam', () => {
    for (const entry of getCommandManifest()) {
      for (const value of Object.values(entry)) {
        expect(typeof value).not.toBe('function');
      }
      expect(entry).not.toHaveProperty('run');
      expect(entry).not.toHaveProperty('when');
    }
  });

  test('availability is always one of the closed union’s members', () => {
    const allowed = ['always', 'selection', 'selection:framework', 'editable'];
    for (const entry of getCommandManifest()) {
      expect(allowed).toContain(entry.availability);
    }
  });

  test('every framework command declares an icon key', () => {
    for (const entry of getCommandManifest()) {
      if (entry.owner === 'core') continue;
      expect(entry.iconKey, entry.id).toBeTruthy();
    }
  });
});

/**
 * The drift this ADR exists to kill: Wardley's menu listed 13 artefacts and
 * its shortcut manifest 7, and nothing detected the six missing ones.
 */
describe('menu and manifest enumerate the same source', () => {
  test('the wardley sub-menu and the wardley manifest agree', () => {
    const menu = wardleyCommands
      .filter(c => c.surfaces.includes('senior-menu'))
      .map(c => c.id);
    const manifest = getCommandManifest()
      .filter(e => e.owner === 'wardley')
      .map(e => e.id);
    expect(menu).toEqual(manifest);
    expect(menu).toHaveLength(13);
  });

  test('every framework offers its whole toolbox to the sub-menu', () => {
    for (const id of FRAMEWORK_IDS as readonly FrameworkId[]) {
      const owned = byOwner(id);
      expect(owned.length, `${id} declares no command`).toBeGreaterThan(0);
      expect(
        owned.every(c => c.surfaces.includes('senior-menu')),
        id
      ).toBe(true);
    }
  });
});
