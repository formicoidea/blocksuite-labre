/**
 * `@labre/affine-shared/headless` — the few shared helpers an interchange
 * reader or writer calls, with no editor behind them (ADR 0012, P3 as amended
 * 2026-10-14). The barrels (`./consts`, `./services`, `./utils`) re-export the
 * same bindings; this entry exists for the headless `./interchange` graphs,
 * held by `interchange-headless.unit.spec.ts` in `packages/affine/all`.
 */
export { NOTATION_NEUTRALS } from './consts/notation.js';
export {
  fillPlaceholders,
  type TranslationParams,
} from './services/translation-service/index.js';
export { safeFilename } from './utils/file/filesys.js';
