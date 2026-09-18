import type {
  FrameworkPalette,
  NamedPalette,
} from '@labre/affine-components/color-picker';
import { CD_SUBDOMAINS } from '@labre/affine-gfx-ddd-shared';
import { neutralPalettes } from '@labre/affine-gfx-shape';
import type { ChromeWording } from '@labre/affine-shared/services';

/**
 * The Core Domain Chart swatches' own names, resolved by `resolvePaletteLabel`
 * (`@labre/affine-components/color-picker`) through each swatch's own
 * {@link NamedPalette.labelWording} — the mechanism `WARDLEY_PALETTE_WORDINGS`
 * established, reused here without either package naming the other.
 *
 * Exported so `../translations.ts` can list them under source `chrome`: a
 * swatch's name is toolbar chrome, never seeded into a document. The keys are
 * this framework's own even though the colours come from `ddd-shared`, which
 * declares no `com.labre.*` key of its own by design (see its header).
 */
export const CORE_DOMAIN_PALETTE_WORDING_BIG_BET: ChromeWording = [
  'com.labre.ddd-core-domain.palette.big-bet-purple',
  'Big-bet purple',
];
export const CORE_DOMAIN_PALETTE_WORDING_PLATFORM: ChromeWording = [
  'com.labre.ddd-core-domain.palette.platform-blue',
  'Platform blue',
];
export const CORE_DOMAIN_PALETTE_WORDING_OUTSOURCED: ChromeWording = [
  'com.labre.ddd-core-domain.palette.outsourced-green',
  'Outsourced green',
];
export const CORE_DOMAIN_PALETTE_WORDING_BC_CURRENT: ChromeWording = [
  'com.labre.ddd-core-domain.palette.bounded-context-red',
  'Bounded context red',
];
export const CORE_DOMAIN_PALETTE_WORDING_BC_FUTURE: ChromeWording = [
  'com.labre.ddd-core-domain.palette.future-position-grey',
  'Future position grey',
];

export const CORE_DOMAIN_PALETTE_WORDINGS: readonly ChromeWording[] = [
  CORE_DOMAIN_PALETTE_WORDING_BIG_BET,
  CORE_DOMAIN_PALETTE_WORDING_PLATFORM,
  CORE_DOMAIN_PALETTE_WORDING_OUTSOURCED,
  CORE_DOMAIN_PALETTE_WORDING_BC_CURRENT,
  CORE_DOMAIN_PALETTE_WORDING_BC_FUTURE,
];

/**
 * The sub-domain / bounded-context dot fills, by kind — derived from
 * {@link CD_SUBDOMAINS} rather than restated.
 */
const CD_FILL = Object.fromEntries(
  CD_SUBDOMAINS.map(subdomain => [subdomain.kind, subdomain.fill])
) as Record<(typeof CD_SUBDOMAINS)[number]['kind'], string>;

/**
 * The Core Domain Chart's own five hues: the three sub-domain classes
 * (big-bet, platform, outsourced), the bounded context as it stands today, and
 * the grey it is plotted in where it is meant to go next.
 *
 * The movement arrow between those last two is drawn in `MOVEMENT_COLOR`,
 * which IS the current bounded context's red — one statement in one colour —
 * so it contributes no sixth swatch. `__tests__/palette.unit.spec.ts` pins the
 * two together, so the day they part the shelf gains its swatch.
 *
 * They are SHORTCUTS, never constraints: a dot's class is written in its role,
 * not read off its fill.
 */
const CORE_DOMAIN_PALETTES: NamedPalette[] = [
  {
    key: 'Big-bet purple',
    value: CD_FILL.bigBet,
    labelWording: CORE_DOMAIN_PALETTE_WORDING_BIG_BET,
  },
  {
    key: 'Platform blue',
    value: CD_FILL.platform,
    labelWording: CORE_DOMAIN_PALETTE_WORDING_PLATFORM,
  },
  {
    key: 'Outsourced green',
    value: CD_FILL.outsourced,
    labelWording: CORE_DOMAIN_PALETTE_WORDING_OUTSOURCED,
  },
  {
    key: 'Bounded context red',
    value: CD_FILL.bcCurrent,
    labelWording: CORE_DOMAIN_PALETTE_WORDING_BC_CURRENT,
  },
  {
    key: 'Future position grey',
    value: CD_FILL.bcFuture,
    labelWording: CORE_DOMAIN_PALETTE_WORDING_BC_FUTURE,
  },
];

/**
 * From the default editor palette we keep ONLY the neutrals — the historical
 * colours say nothing in this notation.
 */
export const CORE_DOMAIN_PALETTE_LIST: NamedPalette[] = [
  ...CORE_DOMAIN_PALETTES,
  ...neutralPalettes(),
];

/**
 * The Core Domain Chart's page of the colour pickers' carousel
 * (`docs/adr/0027`). Registered from the FLAG-GATED view extension, because
 * offering hues is TOOLING: a chart drawn while the flag was on keeps every
 * colour it was painted with when the flag goes off (`docs/adr/0009`).
 */
export const CORE_DOMAIN_FRAMEWORK_PALETTE: FrameworkPalette = {
  framework: 'ddd-core-domain',
  labelWording: ['com.labre.framework.ddd-core-domain', 'Core Domain Chart'],
  palettes: CORE_DOMAIN_PALETTE_LIST,
};
