import { ViewExtensionManager } from '@labre/affine-ext-loader';
import { EDGE_DIRECTION_COLOR } from '@labre/affine-gfx-connector';
import { Container } from '@labre/global/di';
import { type RoleDefs, RoleVocabularyIdentifier } from '@labre/std/gfx';
import { describe, expect, test } from 'vitest';

import { getInternalViewExtensions } from '../extensions/view.js';

/**
 * GUARD — every framework's direction chip is the same blue, and it is the
 * theme's, not a colour a module picked.
 *
 * ## What it would have caught
 *
 * Two chips on one Wardley map in two different blues, which is how the
 * product owner found this: `needs` came out `#2563eb` because
 * `wardley:dependency` declared a `chipColor` on itself (PR #203), and
 * `is evolving towards` came out `#1e96eb` because that was the mechanism's
 * default — AFFiNE's borrowed accent, written as a literal. One role out of
 * the ~26 typed edge roles the nine frameworks ship had an opinion, and the
 * other ~25 silently kept a blue nobody chose. The per-role pin in
 * `gfx/wardley` could not see it: it only ever looked at Wardley.
 *
 * ## What it pins now
 *
 * The chip is chrome — the tool talking about the drawing, not part of the
 * drawing — so its colour is the theme's accent, reached through a token
 * (`DESIGN.md`, The Borrowed Blue Rule). No role overrides it with a hex. The
 * `chipColor` field stays on the contract as an extension point; what it may
 * not carry is a brand hex, because that is the shape that puts a second
 * accent on one board and that no CSS a host writes can move.
 *
 * ## How it checks
 *
 * By MOUNTING the edgeless view extensions and reading the role vocabularies
 * back out of the DI container, the way `reading-coverage.unit.spec.ts` does:
 * the population is the library's own runtime data, so a tenth framework's
 * roles are covered here the day it registers, without anybody remembering it.
 */

/**
 * The accent hexes a role must not restate: AFFiNE's inherited blue
 * (`DESIGN.md`, The Borrowed Blue Rule — it is due to be replaced, and a
 * literal would block the re-skin) and the blue one Wardley role used to
 * declare, which is what made a map read in two blues.
 */
const BANNED_CHIP_HEXES = ['#1e96eb', '#1c9ee4', '#2563eb'];

/** Mount the edgeless view extensions for real and read the DI container back. */
function mountedVocabularies(): RoleDefs[] {
  const manager = new ViewExtensionManager(getInternalViewExtensions({}));
  const container = new Container();
  manager.get('edgeless').forEach(ext => ext.setup(container));
  return Array.from(
    container.provider().getAll(RoleVocabularyIdentifier).values()
  ) as RoleDefs[];
}

describe('the direction chip speaks one blue across every framework', () => {
  const edgeRoles = mountedVocabularies()
    .flatMap(defs => Object.values(defs))
    .filter(def => def.kind === 'edge');

  test('the mechanism defaults to the accent TOKEN, not a colour', () => {
    // The default is what ~26 typed edges are painted with, so this is the one
    // assertion that covers every framework that declares nothing at all. A
    // token rather than a hex is what makes the chip follow a host re-skin
    // along with the rest of the chrome.
    expect(EDGE_DIRECTION_COLOR).toBe('var(--affine-primary-color)');
  });

  test('finds typed edges to check, in more than one framework', () => {
    // Without this the assertions below are vacuous, which is the way a
    // population test most often dies.
    const typed = edgeRoles.filter(def => def.direction?.verbKey);
    expect(typed.length).toBeGreaterThanOrEqual(20);
    expect(
      new Set(typed.map(def => def.id.split(':')[0])).size
    ).toBeGreaterThan(1);
  });

  test('no role declares a chip colour of its own', () => {
    // Today, none: one blue per map, and it is the theme's. `chipColor` stays
    // on the contract (`framework/std/.../role.ts`) as the extension point a
    // framework MAY reach for, but taking it is a design decision, so it goes
    // through a review rather than through a default.
    const claiming = edgeRoles
      .filter(def => def.direction?.chipColor !== undefined)
      .map(def => `${def.id}: ${def.direction!.chipColor}`)
      .sort();
    expect(claiming).toEqual([]);
  });

  test('and none may restate a brand hex if one ever does', () => {
    // The assertion above is the strict one and the one that holds today; this
    // is the floor it degrades to. If a framework is one day allowed its own
    // chip colour, it still may not be one of the accents — restating the
    // accent as a literal is exactly what put two blues on one map and what
    // keeps a host re-skin from reaching the chip.
    const banned = edgeRoles
      .filter(def =>
        BANNED_CHIP_HEXES.includes(
          def.direction?.chipColor?.toLowerCase() ?? ''
        )
      )
      .map(def => def.id)
      .sort();
    expect(banned).toEqual([]);
  });
});
