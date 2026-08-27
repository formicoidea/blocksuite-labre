// The declaration IS the pool: what it looks like, where its plot is and how
// its lanes divide that plot are all read off this one value (`docs/adr/0009`
// on why a framework declares rather than draws). Exported so a host — and the
// audit's own consumers — can answer those questions without a canvas.
export { BPMN_POOL_BACKGROUND } from './background.js';
// Everything on the surface the exporter speaks about, in document order — the
// half of the export that needs an editor, kept apart from the half that does
// not so a host can substitute either.
export { bpmnBoardOf } from './actions.js';
export { bpmnCommandIcons, bpmnCommands } from './commands';
// The board as a BPMN 2.0 interchange document. A pure function — element
// models in, XML out — so a host can export a board it never rendered, and the
// kind → element table it is built on is readable without running it.
export {
  BPMN_NS,
  BPMN_XML_OF_KIND,
  type BpmnExportBoard,
  type BpmnExportOptions,
  type BpmnExportOutcome,
  type BpmnXmlMapping,
  exportBpmnXml,
  exportBpmnXmlWithWarnings,
  toNcName,
} from './export.js';
// BPMN's entries in the interchange registry (`docs/adr/0012`) — one today,
// `.bpmn` OUT. Exported whole so a host can ask what BPMN can read and write
// without mounting an editor, and call it without one either.
export {
  BPMN_INTERCHANGE,
  BPMN_XML_EXPORT,
  BPMN_XML_EXTENSION,
  BPMN_XML_FORMAT,
  BPMN_XML_MIME,
  bpmnBoardFrom,
  bpmnSafeFilename,
} from './interchange.js';
// Where an artefact sits, without a `BlockStdScope`: the same pool and lane
// attribution the audit computes, answerable by a rule, a host or a test.
export { bpmnLaneOf, bpmnPoolOf } from './facts.js';
// The levels of requirement, and the rules they arbitrate: DATA a host can read,
// ship and reason about without an editor.
export { BPMN_PROFILES } from './profiles.js';
export {
  BPMN_ROLE,
  BPMN_ROLE_OF_KIND,
  BPMN_ROLES,
  type BpmnRole,
  type BpmnRoleId,
} from './roles.js';
export { BPMN_RULES, BPMN_SEQUENCE_MATRIX } from './rules.js';
export { bpmnTranslationEntries } from './translations.js';
