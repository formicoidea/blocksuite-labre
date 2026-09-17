import type {
  FrameworkPalette,
  NamedPalette,
} from '@labre/affine-components/color-picker';
import { neutralPalettes } from '@labre/affine-gfx-shape';
import type { ChromeWording } from '@labre/affine-shared/services';

import { EVENT_END, EVENT_START } from '../consts.js';

/**
 * The two BPMN swatches' own names, resolved by `resolvePaletteLabel`
 * (`@labre/affine-components/color-picker`) through each swatch's own
 * {@link NamedPalette.labelWording} — the mechanism `WARDLEY_PALETTE_WORDINGS`
 * established, reused here without either package naming the other.
 *
 * Exported so `../translations.ts` can list them under source `chrome`: a
 * swatch's name is toolbar chrome, never seeded into a document.
 */
export const BPMN_PALETTE_WORDING_START: ChromeWording = [
  'com.labre.bpmn.palette.start-green',
  'Start green',
];
export const BPMN_PALETTE_WORDING_END: ChromeWording = [
  'com.labre.bpmn.palette.end-red',
  'End red',
];

export const BPMN_PALETTE_WORDINGS: readonly ChromeWording[] = [
  BPMN_PALETTE_WORDING_START,
  BPMN_PALETTE_WORDING_END,
];

/**
 * BPMN's own two hues — and deliberately only two.
 *
 * BPMN is a black-and-white notation: the SHAPE carries the meaning and the
 * ink is the shared notation grey (`NEUTRAL_STROKE`, `NODE_FILL`, see
 * `../consts.ts`), so a long shelf of BPMN colours would be an invention
 * rather than the standard. The exceptions the pack itself draws are the two
 * ends of a process — the start event's green ring and the end event's red one
 * — and those are the two the picker offers, read off the consts rather than
 * restated.
 *
 * Everything else an author needs is the neutral tail below, and the base
 * palette which the carousel never hides.
 */
const BPMN_PALETTES: NamedPalette[] = [
  {
    key: 'Start green',
    value: EVENT_START,
    labelWording: BPMN_PALETTE_WORDING_START,
  },
  {
    key: 'End red',
    value: EVENT_END,
    labelWording: BPMN_PALETTE_WORDING_END,
  },
];

/** The two notation hues, then the neutrals every drawing needs. */
export const BPMN_PALETTE_LIST: NamedPalette[] = [
  ...BPMN_PALETTES,
  ...neutralPalettes(),
];

/**
 * BPMN's page of the colour pickers' carousel (`docs/adr/0027`). Registered
 * from the FLAG-GATED view extension, because offering hues is TOOLING: a
 * process drawn while the flag was on keeps every colour it was painted with
 * when the flag goes off (`docs/adr/0009`).
 */
export const BPMN_FRAMEWORK_PALETTE: FrameworkPalette = {
  framework: 'bpmn',
  labelWording: ['com.labre.framework.bpmn', 'BPMN'],
  palettes: BPMN_PALETTE_LIST,
};
