import type {
  FrameworkPalette,
  NamedPalette,
} from '@labre/affine-components/color-picker';
import {
  CLOUD,
  CM_BUBBLE,
  TEAM_TOPOLOGIES,
} from '@labre/affine-gfx-ddd-shared';
import { neutralPalettes } from '@labre/affine-gfx-shape';
import type { ChromeWording } from '@labre/affine-shared/services';

/**
 * The Context Map swatches' own names, resolved by `resolvePaletteLabel`
 * (`@labre/affine-components/color-picker`) through each swatch's own
 * {@link NamedPalette.labelWording} — the mechanism `WARDLEY_PALETTE_WORDINGS`
 * established, reused here without either package naming the other.
 *
 * Exported so `../translations.ts` can list them under source `chrome`: a
 * swatch's name is toolbar chrome, never seeded into a document. The keys are
 * this framework's own even though the colours come from `ddd-shared`, which
 * declares no `com.labre.*` key of its own by design (see its header).
 */
export const CONTEXT_MAP_PALETTE_WORDING_BUBBLE: ChromeWording = [
  'com.labre.ddd-context-map.palette.bounded-context-blue',
  'Bounded context blue',
];
export const CONTEXT_MAP_PALETTE_WORDING_BUBBLE_OUTLINE: ChromeWording = [
  'com.labre.ddd-context-map.palette.bounded-context-outline',
  'Bounded context outline',
];
export const CONTEXT_MAP_PALETTE_WORDING_CLOUD: ChromeWording = [
  'com.labre.ddd-context-map.palette.big-ball-of-mud-lilac',
  'Big ball of mud lilac',
];
export const CONTEXT_MAP_PALETTE_WORDING_COLLABORATION: ChromeWording = [
  'com.labre.ddd-context-map.palette.collaboration-green',
  'Collaboration green',
];
export const CONTEXT_MAP_PALETTE_WORDING_XAAS: ChromeWording = [
  'com.labre.ddd-context-map.palette.x-as-a-service-blue',
  'X-as-a-Service blue',
];
export const CONTEXT_MAP_PALETTE_WORDING_FACILITATING: ChromeWording = [
  'com.labre.ddd-context-map.palette.facilitating-yellow',
  'Facilitating yellow',
];

export const CONTEXT_MAP_PALETTE_WORDINGS: readonly ChromeWording[] = [
  CONTEXT_MAP_PALETTE_WORDING_BUBBLE,
  CONTEXT_MAP_PALETTE_WORDING_BUBBLE_OUTLINE,
  CONTEXT_MAP_PALETTE_WORDING_CLOUD,
  CONTEXT_MAP_PALETTE_WORDING_COLLABORATION,
  CONTEXT_MAP_PALETTE_WORDING_XAAS,
  CONTEXT_MAP_PALETTE_WORDING_FACILITATING,
];

/**
 * The Team Topologies interaction-mode fills, by kind — derived from
 * {@link TEAM_TOPOLOGIES} rather than restated.
 */
const TEAM_MODE_FILL = Object.fromEntries(
  TEAM_TOPOLOGIES.map(mode => [mode.kind, mode.fill])
) as Record<(typeof TEAM_TOPOLOGIES)[number]['kind'], string>;

/**
 * What a Context Map is drawn in: the bounded-context bubble (its wash and the
 * blue it is outlined in), the Big-Ball-of-Mud cloud's lilac, and the three
 * Team Topologies interaction modes — collaboration, X-as-a-Service,
 * facilitating — whose LETTER is the notation and whose colour is the
 * shorthand a reader picks up first.
 *
 * Every value is read off the shared DDD tables rather than restated, so the
 * shelf and the notation cannot drift apart. They are SHORTCUTS, never
 * constraints: no rule of this pack reads a colour.
 */
const CONTEXT_MAP_PALETTES: NamedPalette[] = [
  {
    key: 'Bounded context blue',
    value: CM_BUBBLE.fill,
    labelWording: CONTEXT_MAP_PALETTE_WORDING_BUBBLE,
  },
  {
    key: 'Bounded context outline',
    value: CM_BUBBLE.stroke,
    labelWording: CONTEXT_MAP_PALETTE_WORDING_BUBBLE_OUTLINE,
  },
  {
    key: 'Big ball of mud lilac',
    value: CLOUD.fill,
    labelWording: CONTEXT_MAP_PALETTE_WORDING_CLOUD,
  },
  {
    key: 'Collaboration green',
    value: TEAM_MODE_FILL.collaboration,
    labelWording: CONTEXT_MAP_PALETTE_WORDING_COLLABORATION,
  },
  {
    key: 'X-as-a-Service blue',
    value: TEAM_MODE_FILL.xaas,
    labelWording: CONTEXT_MAP_PALETTE_WORDING_XAAS,
  },
  {
    key: 'Facilitating yellow',
    value: TEAM_MODE_FILL.facilitating,
    labelWording: CONTEXT_MAP_PALETTE_WORDING_FACILITATING,
  },
];

/**
 * From the default editor palette we keep ONLY the neutrals — the historical
 * colours say nothing in this notation.
 */
export const CONTEXT_MAP_PALETTE_LIST: NamedPalette[] = [
  ...CONTEXT_MAP_PALETTES,
  ...neutralPalettes(),
];

/**
 * The Context Map's page of the colour pickers' carousel (`docs/adr/0027`).
 * Registered from the FLAG-GATED view extension, because offering hues is
 * TOOLING: a map drawn while the flag was on keeps every colour it was painted
 * with when the flag goes off (`docs/adr/0009`).
 */
export const CONTEXT_MAP_FRAMEWORK_PALETTE: FrameworkPalette = {
  framework: 'ddd-context-map',
  labelWording: ['com.labre.framework.ddd-context-map', 'Context Map'],
  palettes: CONTEXT_MAP_PALETTE_LIST,
};
