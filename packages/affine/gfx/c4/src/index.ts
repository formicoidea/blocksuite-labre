// The declarations ARE the two frames: what they look like, where their plot is
// and which words they carry are all read off these two values (`docs/adr/0009`
// on why a framework declares rather than draws). Exported so a host — and the
// audit's own consumers — can answer those questions without a canvas.
export { C4_BOARD_BACKGROUND, C4_BOUNDARY_BACKGROUND } from './background.js';
export {
  BOUNDARY_LABEL,
  type C4NodePaint,
  NODE_LABEL,
  NODE_PALETTE,
  NODE_RADIUS,
  NODE_SIZE,
  NODE_STROKE_WIDTH,
  RELATIONSHIP_STROKE,
  RELATIONSHIP_WIDTH,
} from './consts.js';
export {
  C4_ROLE,
  C4_ROLE_OF_KIND,
  C4_ROLES,
  type C4Role,
  type C4RoleId,
} from './roles.js';
// The toolbox, for the host that composes the command registry and the
// translation-key manifest out of the frameworks it installed (see
// `packages/affine/all/src/{commands,translations}.ts`).
export { c4CommandIcons, c4Commands } from './commands.js';
export { c4TranslationEntries } from './translations.js';
// The legend TABLE — what the board's automatic legend can say. Exported for
// the same reason the two background declarations are: it answers "what does
// this framework document about itself" without a canvas.
export { C4_AUTO_LEGEND } from './legend.js';
