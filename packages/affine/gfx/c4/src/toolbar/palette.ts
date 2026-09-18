import type {
  FrameworkPalette,
  NamedPalette,
} from '@labre/affine-components/color-picker';
import { neutralPalettes } from '@labre/affine-gfx-shape';
import type { ChromeWording } from '@labre/affine-shared/services';

import { NODE_PALETTE, RELATIONSHIP_STROKE } from '../consts.js';

/**
 * The C4 swatches' own names, resolved by `resolvePaletteLabel`
 * (`@labre/affine-components/color-picker`) through each swatch's own
 * {@link NamedPalette.labelWording} — the same framework-agnostic mechanism
 * Wardley and EDGY use (`WARDLEY_PALETTE_WORDINGS`), so nothing here touches
 * `packages/affine/model` (RED ZONE) or another framework's package.
 *
 * Exported so `../translations.ts` can list them under source `chrome`: a
 * swatch's name is toolbar chrome, re-rendered on every locale switch, never
 * seeded into a document.
 */
export const C4_PALETTE_WORDING_PERSON: ChromeWording = [
  'com.labre.c4.palette.person-blue',
  'Person blue',
];
export const C4_PALETTE_WORDING_SYSTEM: ChromeWording = [
  'com.labre.c4.palette.system-blue',
  'System blue',
];
export const C4_PALETTE_WORDING_CONTAINER: ChromeWording = [
  'com.labre.c4.palette.container-blue',
  'Container blue',
];
export const C4_PALETTE_WORDING_COMPONENT: ChromeWording = [
  'com.labre.c4.palette.component-blue',
  'Component blue',
];
export const C4_PALETTE_WORDING_EXTERNAL: ChromeWording = [
  'com.labre.c4.palette.external-grey',
  'External grey',
];
export const C4_PALETTE_WORDING_RELATIONSHIP: ChromeWording = [
  'com.labre.c4.palette.relationship-grey',
  'Relationship grey',
];

export const C4_PALETTE_WORDINGS: readonly ChromeWording[] = [
  C4_PALETTE_WORDING_PERSON,
  C4_PALETTE_WORDING_SYSTEM,
  C4_PALETTE_WORDING_CONTAINER,
  C4_PALETTE_WORDING_COMPONENT,
  C4_PALETTE_WORDING_EXTERNAL,
  C4_PALETTE_WORDING_RELATIONSHIP,
];

/**
 * The C4 **level ladder**, surfaced as ready-made swatches.
 *
 * C4's stencil IS a colour code (see `../consts.ts`): the four levels are four
 * blues running lighter as they go in — person, software system, container,
 * component — anything outside the diagram's scope is one grey, and everything
 * that is not an element (the relationship arrow, the boundary frame) is drawn
 * in a second, darker one.
 *
 * Every value is read off {@link NODE_PALETTE} and {@link RELATIONSHIP_STROKE}
 * rather than restated, so the shelf and the notation cannot drift apart. They
 * are SHORTCUTS, never constraints: no rule of this pack reads a colour.
 */
const C4_PALETTES: NamedPalette[] = [
  {
    key: 'Person blue',
    value: NODE_PALETTE.person.fill,
    labelWording: C4_PALETTE_WORDING_PERSON,
  },
  {
    key: 'System blue',
    value: NODE_PALETTE.system.fill,
    labelWording: C4_PALETTE_WORDING_SYSTEM,
  },
  {
    key: 'Container blue',
    value: NODE_PALETTE.container.fill,
    labelWording: C4_PALETTE_WORDING_CONTAINER,
  },
  {
    key: 'Component blue',
    value: NODE_PALETTE.component.fill,
    labelWording: C4_PALETTE_WORDING_COMPONENT,
  },
  // One grey for both external kinds, because the stencil paints them the same:
  // "outside the scope of this diagram" is one statement.
  {
    key: 'External grey',
    value: NODE_PALETTE['system-ext'].fill,
    labelWording: C4_PALETTE_WORDING_EXTERNAL,
  },
  // The grey of the relationship arrow — and of the boundary frame, which the
  // stencil draws in the very same `#444444`.
  {
    key: 'Relationship grey',
    value: RELATIONSHIP_STROKE,
    labelWording: C4_PALETTE_WORDING_RELATIONSHIP,
  },
];

/**
 * From the default editor palette we keep ONLY the neutrals — the historical
 * colours say nothing in this notation.
 */
export const C4_PALETTE_LIST: NamedPalette[] = [
  ...C4_PALETTES,
  ...neutralPalettes(),
];

/**
 * C4's page of the colour pickers' carousel (`docs/adr/0027`). Registered from
 * the FLAG-GATED view extension, because offering hues is TOOLING: a diagram
 * drawn while the flag was on keeps every colour it was painted with when the
 * flag goes off — the shelf that offers more of them is what goes away
 * (`docs/adr/0009`).
 */
export const C4_FRAMEWORK_PALETTE: FrameworkPalette = {
  framework: 'c4',
  labelWording: ['com.labre.framework.c4', 'C4 model'],
  palettes: C4_PALETTE_LIST,
};
