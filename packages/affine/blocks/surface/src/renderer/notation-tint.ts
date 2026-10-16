import {
  NOTATION_NEUTRALS,
  NOTATION_NEUTRALS_DARK,
  type NotationNeutral,
} from '@labre/affine-shared/consts';
import { createIdentifier } from '@labre/global/di';
import type { FrameworkId } from '@labre/std';
import type { ExtensionType } from '@labre/store';

/**
 * The dark variant of the framework notations, resolved AT RENDER TIME
 * (ADR 0039).
 *
 * A notation element stores plain colour values (`'#438dd5'`, the scale's
 * `'#1f2328'`). On a dark canvas those values are not rewritten: the painter
 * asks this table what to paint instead, so the document, the undo stack, the
 * sync and every reader of a stored colour see exactly what they saw before.
 *
 * The rule is "the paper inverts, the hues stay":
 *
 * - the shared neutrals ({@link NOTATION_NEUTRALS}) map key for key onto
 *   {@link NOTATION_NEUTRALS_DARK};
 * - a framework adds the few values of its own that would vanish on the dark
 *   card (a stencil ink, a near-black label, a pale wash behind words) through
 *   {@link NotationDarkPaletteExtension};
 * - everything else, every hue of a standard included, is painted as stored.
 *   EDGY's facets, the C4 ladder, a BPMN end event and a colour typed by hand
 *   all stay what they are.
 *
 * White is the one value with two jobs: as a SURFACE (a node body, the board
 * card) it is the paper and inverts; as an INK (white words on a C4 person,
 * EDGY's white pictos) it stays. Hence the two uses below.
 */

/** What a colour is painted as: a line or words, or a surface. */
export type NotationColorUse = 'ink' | 'fill';

/**
 * One framework's dark entries, light value → dark value. Keys are `#rrggbb`
 * (any case); a stored `#rrggbbaa` keeps its alpha.
 *
 * `kept` lists the swatches of the framework's palette that deliberately have
 * no dark entry (a standard's hue that reads on the dark card as it is), so a
 * swatch added later without a decision fails `notation-dark-palettes`.
 */
export type NotationDarkPalette = {
  framework: FrameworkId;
  colors: Readonly<Record<string, string>>;
  kept?: readonly string[];
};

/**
 * Multi-instance, keyed by framework, like `FrameworkPaletteIdentifier`: two
 * registrations for one framework collide at set-up.
 */
export const NotationDarkPaletteIdentifier =
  createIdentifier<NotationDarkPalette>('NotationDarkPalette');

/**
 * Register a framework's dark entries. Call it from the ALWAYS-ON render view
 * extension, beside the renderers: painting a stored document is content, so
 * it never depends on the framework's flag (ADR 0009).
 */
export function NotationDarkPaletteExtension(
  palette: NotationDarkPalette
): ExtensionType {
  return {
    setup: di => {
      di.addImpl(
        NotationDarkPaletteIdentifier(palette.framework),
        () => palette
      );
    },
  };
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** `#rgb` / `#rrggbb` / `#rrggbbaa` → lower-case `#rrggbb` and the alpha tail. */
function splitHex(value: string): { rgb: string; alpha: string } | null {
  const match = HEX.exec(value.trim());
  if (!match) return null;
  const digits = match[1]!.toLowerCase();
  if (digits.length === 3) {
    return { rgb: `#${[...digits].map(d => d + d).join('')}`, alpha: '' };
  }
  return { rgb: `#${digits.slice(0, 6)}`, alpha: digits.slice(6) };
}

function normalised(table: Readonly<Record<string, string>>) {
  const out = new Map<string, string>();
  for (const [light, dark] of Object.entries(table)) {
    const key = splitHex(light);
    if (key) out.set(key.rgb, dark.toLowerCase());
  }
  return out;
}

const NEUTRAL_KEYS = Object.keys(NOTATION_NEUTRALS) as NotationNeutral[];

/** The scale, light → dark, minus the card: white is a surface only. */
const NEUTRAL_INKS: Readonly<Record<string, string>> = Object.fromEntries(
  NEUTRAL_KEYS.filter(key => key !== 'cardFill').map(key => [
    NOTATION_NEUTRALS[key],
    NOTATION_NEUTRALS_DARK[key],
  ])
);

/**
 * A resolved dark table: the neutrals plus every registered framework's
 * entries. Pure; the canvas renderer builds one per editor and hands it to
 * the painters of notation elements only.
 */
export class NotationTint {
  private readonly _inks: Map<string, string>;

  private readonly _surfaces: Map<string, string>;

  /**
   * `palettes` in any order. A light value two frameworks map differently is
   * a declaration bug; the first one wins here and
   * `notation-dark-palettes.unit.spec.ts` names it.
   */
  constructor(palettes: readonly NotationDarkPalette[] = []) {
    this._inks = normalised(NEUTRAL_INKS);
    for (const palette of palettes) {
      for (const [light, dark] of normalised(palette.colors)) {
        if (!this._inks.has(light)) this._inks.set(light, dark);
      }
    }
    this._surfaces = normalised({
      [NOTATION_NEUTRALS.cardFill]: NOTATION_NEUTRALS_DARK.cardFill,
    });
  }

  /**
   * What to paint for a stored or declared `value`. Anything that is not a
   * hex literal (`rgba(…)`, `transparent`, a variable) is returned untouched.
   */
  resolve(value: string, use: NotationColorUse = 'ink'): string {
    const parts = splitHex(value);
    if (!parts) return value;
    const dark =
      (use === 'fill' ? this._surfaces.get(parts.rgb) : undefined) ??
      this._inks.get(parts.rgb);
    return dark ? dark + parts.alpha : value;
  }

  /**
   * Whether words drawn on this fill keep their stored colour ("ink follows
   * its paper"): true when the fill is painted as stored and is opaque enough
   * to be what the words sit on. A fill that inverts, or a wash below half
   * opacity, puts the words on the dark card, so they invert too.
   *
   * This is what keeps black words on a C4 component and dark words on an
   * Event Storming sticky readable while the same black on the bare card turns
   * light.
   */
  keepsInkOn(fill: string): boolean {
    const parts = splitHex(fill);
    if (!parts) return false;
    if (parts.alpha && Number.parseInt(parts.alpha, 16) < 128) return false;
    return this.resolve(fill, 'fill') === fill;
  }
}

/**
 * The colour a painter of a notation element should use for a CONSTANT it
 * holds (a board's declared wash, a glyph's stencil ink).
 *
 * `renderer` is optional and duck-typed on purpose: a unit test drives a
 * painter with a bare stub, or with no renderer at all, and both must paint
 * the value as given.
 */
export function notationColor(
  renderer: unknown,
  value: string,
  use: NotationColorUse = 'ink'
): string {
  const tint = (renderer as { notationTint?: NotationTint | null } | undefined)
    ?.notationTint;
  return tint ? tint.resolve(value, use) : value;
}
