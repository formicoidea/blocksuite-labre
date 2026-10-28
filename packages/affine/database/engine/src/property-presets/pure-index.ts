import { checkboxPropertyModelConfig } from './checkbox/define.js';
import { datePropertyModelConfig } from './date/define.js';
import { imagePropertyModelConfig } from './image/define.js';
import { multiSelectPropertyModelConfig } from './multi-select/define.js';
import { numberPropertyModelConfig } from './number/define.js';
import { progressPropertyModelConfig } from './progress/define.js';
import { selectPropertyModelConfig } from './select/define.js';
import { textPropertyModelConfig } from './text/define.js';

export const propertyModelPresets = {
  checkboxPropertyModelConfig,
  datePropertyModelConfig,
  imagePropertyModelConfig,
  multiSelectPropertyModelConfig,
  numberPropertyModelConfig,
  progressPropertyModelConfig,
  selectPropertyModelConfig,
  textPropertyModelConfig,
};

// The number preset's formats and formatter, so the title band's own copy of
// the table (`fragments/doc-title/src/title-band/format.ts`) can be held to
// it by a parity spec (`title-band-number-parity.unit.spec.ts`).
export {
  formatNumber,
  type NumberFormat,
  NumberFormatSchema,
} from './number/utils/formatter.js';
