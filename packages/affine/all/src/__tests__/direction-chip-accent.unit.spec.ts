import { ViewExtensionManager } from '@labre/affine-ext-loader';
import { EDGE_DIRECTION_COLOR } from '@labre/affine-gfx-connector';
import { LABRE_ACCENT } from '@labre/affine-shared/consts';
import { Container } from '@labre/global/di';
import { RoleVocabularyIdentifier, type RoleDefs } from '@labre/std/gfx';
import { describe, expect, test } from 'vitest';

import { getInternalViewExtensions } from '../extensions/view.js';

/**
 * GUARD — every framework's direction chip is the SAME blue, and it is Labre's.
 *
 * ## What it would have caught
 *
 * Two chips on one Wardley map in two different blues, which is how the product
 * owner found this: "needs" came out `#2563eb` because `wardley:dependency`
 * declared a `chipColor` on itself (PR #203), and "is evolving towards" came out
 * `#1e96eb` because that was the mechanism's default — AFFiNE's borrowed accent.
 * One role out of the ~26 typed edge roles the nine frameworks ship had an
 * opinion, and the other ~25 silently kept a blue nobody chose. The per-role pin
 * in `gfx/wardley` could not see that, because it only ever looked at Wardley.
 *
 * The borrowed blue also fails WCAG AA under the chip's own white text (3.17:1);
 * the accent settled on in PR #395 passes (5.17:1). So a framework that
 * re-declared `#1e96eb` to "match the others" would quietly reintroduce an
 * accessibility defect as well as a second blue — hence the second test, which
 * bans that value by name rather than merely requiring uniformity.
 *
 * ## How it checks
 *
 * By MOUNTING the edgeless view extensions and reading the role vocabularies
 * back out of the DI container, the way `reading-coverage.unit.spec.ts` does:
 * the population is the library's own runtime data, so a tenth framework's
 * roles are covered here the day it registers, without anybody remembering it.
 */

/** AFFiNE's inherited accent — `DESIGN.md`, "The Borrowed Blue Rule". */
const BORROWED_BLUE = '#1e96eb';

/** Mount the edgeless view extensions for real and read the DI container back. */
function mountedVocabularies(): RoleDefs[] {
  const manager = new ViewExtensionManager(getInternalViewExtensions({}));
  const container = new Container();
  manager.get('edgeless').forEach(ext => ext.setup(container));
  return Array.from(
    container.provider().getAll(RoleVocabularyIdentifier).values()
  ) as RoleDefs[];
}

/** WCAG 2.1 relative luminance of an `#rrggbb` colour. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map(at => {
    const value = parseInt(hex.slice(at, at + 2), 16) / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Contrast ratio of a colour against white text. */
const againstWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

describe('the direction chip speaks one blue across every framework', () => {
  const vocabularies = mountedVocabularies();
  const edgeRoles = vocabularies
    .flatMap(defs => Object.values(defs))
    .filter(def => def.kind === 'edge');

  test('the mechanism defaults to the Labre accent', () => {
    // The default is what ~26 typed edges are painted with, so this is the one
    // assertion that covers the frameworks that declare nothing at all.
    expect(EDGE_DIRECTION_COLOR).toBe(LABRE_ACCENT);
    expect(LABRE_ACCENT).toBe('#2563eb');
  });

  test('finds typed edges to check, in more than one framework', () => {
    // Without this the two assertions below are vacuous, which is the way a
    // population test most often dies.
    const typed = edgeRoles.filter(def => def.direction?.verbKey);
    expect(typed.length).toBeGreaterThanOrEqual(20);
    expect(
      new Set(typed.map(def => def.id.split(':')[0])).size
    ).toBeGreaterThan(1);
  });

  test('no role re-declares the borrowed AFFiNE blue', () => {
    // `chipColor` stays on the contract as an extension point — a framework MAY
    // claim its own. What it may not do is restate the blue Labre is leaving.
    const borrowed = edgeRoles
      .filter(def => def.direction?.chipColor?.toLowerCase() === BORROWED_BLUE)
      .map(def => def.id)
      .sort();
    expect(borrowed).toEqual([]);
  });

  test('any chip colour a role does declare carries white text', () => {
    // The chip's text is `#fff` (`direction-widget.ts`), so every colour that
    // can land under it — the default included — owes AA on normal text.
    expect(againstWhite(LABRE_ACCENT)).toBeGreaterThanOrEqual(4.5);
    expect(againstWhite(BORROWED_BLUE)).toBeLessThan(4.5);

    const unreadable = edgeRoles
      .filter(def => def.direction?.chipColor !== undefined)
      .filter(def => againstWhite(def.direction!.chipColor!) < 4.5)
      .map(def => def.id)
      .sort();
    expect(unreadable).toEqual([]);
  });
});
