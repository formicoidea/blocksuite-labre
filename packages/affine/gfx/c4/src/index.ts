// The declarations ARE the two frames: what they look like, where their plot is
// and which words they carry are all read off these two values (`docs/adr/0009`
// on why a framework declares rather than draws). Exported so a host — and the
// audit's own consumers — can answer those questions without a canvas.
export { C4_BOARD_BACKGROUND, C4_BOUNDARY_BACKGROUND } from './background.js';
export {
  BOUNDARY_LABEL,
  type C4NodePaint,
  DESCRIPTION_PLACEHOLDER,
  NODE_LABEL,
  NODE_PALETTE,
  NODE_RADIUS,
  NODE_SIZE,
  NODE_STROKE_WIDTH,
  RELATIONSHIP_STROKE,
  RELATIONSHIP_WIDTH,
} from './consts.js';
// The middle tier of an element's label, SEMI-DERIVED: the word from the kind,
// the technology from the author. Pure and total over the nine kinds and over
// every string an author can type, so a host, a rule or a reading can name an
// element exactly as the canvas does — and read the technology back out of it.
export {
  C4_TYPE_PLACEHOLDER,
  C4_TYPE_TAKES_TECHNOLOGY,
  C4_TYPE_WORD,
  c4TypeLine,
  normalizeC4TypeLine,
  technologyOfTypeLine,
  TYPE_TECHNOLOGY_PLACEHOLDER,
} from './type-line.js';
// A C4 component — the shape and its own words, grouped. Where the two written
// tiers are placed at creation, and which of them belongs to which node. Pure,
// so the creation site, the exporter and a host all resolve a component the
// same way.
export {
  type C4ComponentGroup,
  type C4ComponentTiers,
  c4ComponentSiblings,
  c4ComponentTiers,
  c4StatedDescription,
  c4StatedTechnology,
  type C4TierBox,
  type C4TierBoxes,
  c4TierBoxes,
  type C4TierElement,
  c4TierText,
} from './component.js';
export {
  C4_ROLE,
  C4_ROLE_OF_KIND,
  C4_ROLES,
  type C4Role,
  type C4RoleId,
} from './roles.js';
// The half of the export that needs an editor, kept apart from the half that
// does not — same split BPMN's index makes for the same reason.
export { c4BoardsForExport, c4ExportBoardOf } from './actions.js';
// The export itself: a PURE function over element models — models in, mermaid
// out — so a host can export a board it never rendered, and a rule or a test can
// call it with plain stubs.
export {
  type C4ExportBoard,
  C4_MERMAID_OF_KIND,
  type C4MermaidMapping,
  exportC4Mermaid,
  toMermaidAlias,
  toMermaidText,
} from './export.js';
// The toolbox, for the host that composes the command registry and the
// translation-key manifest out of the frameworks it installed (see
// `packages/affine/all/src/{commands,translations}.ts`).
export { c4CommandIcons, c4Commands } from './commands.js';
export { c4TranslationEntries } from './translations.js';
// The legend TABLE — what the board's automatic legend can say. Exported for
// the same reason the two background declarations are: it answers "what does
// this framework document about itself" without a canvas.
export { C4_AUTO_LEGEND } from './legend.js';
