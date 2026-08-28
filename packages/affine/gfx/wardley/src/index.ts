export {
  WARDLEY_ROLE,
  WARDLEY_ROLES,
  type WardleyRole,
  type WardleyRoleId,
} from './roles';
export { WARDLEY_AUDIT_CRITERIA } from './audit-criteria';
export { wardleyCommandIcons, wardleyCommands } from './commands';
export { wardleyTranslationEntries } from './translations.js';
export {
  WARDLEY_NATURE,
  WARDLEY_NATURE_TAG_ID,
  WARDLEY_TAG_DEFS,
} from './natures';
export { WARDLEY_PROFILES } from './profiles';
export { WARDLEY_NUDGES } from './nudges';
export { WARDLEY_NAMING_CONVENTIONS, WARDLEY_READING } from './reading';
export { WARDLEY_RULES } from './rules';
/**
 * The map's own frame, declared. Public because a host that lays elements out
 * against the plot — labre-mcp does, and so does anything that generates a map
 * without an editor — needs the margins the renderer actually uses, and a
 * second copy of four numbers is a copy that drifts (`templates/maps.ts` says
 * how that went the first time). P3's packaging obligation: a value both
 * consumers read is reachable from the index, never by deep import.
 */
export { WARDLEY_BACKGROUND } from './background';
/**
 * The OWM DSL, both directions — pure functions of text and models, exported
 * for the reason ADR 0012 § P3 gives: the editor command and labre-mcp call the
 * SAME function, and no serialization logic for a Labre framework lives outside
 * this repo. `exportWardleyOwm` is what replaces labre-mcp's own serializer.
 */
export {
  exportWardleyOwm,
  exportWardleyOwmWithWarnings,
  OWM_SCOPE,
  type OwmPlot,
  owmCoordsOf,
  owmPlotOf,
  owmPointOf,
  WARDLEY_OWM_FORMAT_ID,
  type WardleyExportBoard,
  wardleyBoardFrom,
  wardleySafeFilename,
} from './export';
export { importWardleyOwm } from './import';
export {
  WARDLEY_INTERCHANGE,
  WARDLEY_OWM_EXPORT,
  WARDLEY_OWM_EXTENSION,
  WARDLEY_OWM_FORMAT,
  WARDLEY_OWM_IMPORT,
  WARDLEY_OWM_MIME,
} from './interchange';
