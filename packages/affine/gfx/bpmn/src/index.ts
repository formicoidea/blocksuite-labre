// The declaration IS the pool: what it looks like, where its plot is and how
// its lanes divide that plot are all read off this one value (`docs/adr/0009`
// on why a framework declares rather than draws). Exported so a host — and the
// audit's own consumers — can answer those questions without a canvas.
export { BPMN_POOL_BACKGROUND } from './background.js';
// Everything on the surface the exporter speaks about, in document order — the
// half of the export that needs an editor, kept apart from the half that does
// not so a host can substitute either.
export { bpmnBoardOf } from './actions.js';
// …and the mirror half of the import: the reader is pure, and THIS is the one
// thing its caller owes it — the surface mints ids, so a connector's endpoints
// arrive naming the source file's and are rewritten from the map the returned
// array already carries (`docs/adr/0012`, D3). Exported so the command, the
// chromium round trip and a host embedding the reader all write a board the
// same way.
export { materializeBpmnImport, reportBpmnImport } from './actions.js';
export { bpmnCommandIcons, bpmnCommands } from './commands';
// The board as a BPMN 2.0 interchange document. A pure function — element
// models in, XML out — so a host can export a board it never rendered, and the
// kind → element table it is built on is readable without running it.
export {
  BPMN_FORMAT_ID,
  BPMN_NS,
  BPMN_XML_OF_KIND,
  type BpmnExportBoard,
  type BpmnExportOptions,
  type BpmnExportOutcome,
  type BpmnXmlMapping,
  exportBpmnXml,
  exportBpmnXmlWithWarnings,
  isNcName,
  toNcName,
} from './export.js';
// …and the same file, back as a board. A pure function too — text in, element
// PROPS out, never live models — so labre-mcp reads a `.bpmn` through the one
// implementation the editor reads it through (`docs/adr/0012`, P3).
export {
  BPMN_KIND_OF_XML,
  BPMN_QUARANTINE_REASON,
  importBpmnXml,
} from './import.js';
// What an artefact is BORN as, shared by the palette and the importer so a task
// read out of a file and a task drawn by hand are one element in the document —
// and, since the morph, by the toolbar that says one artefact more precisely.
// `bpmnLabelFit` rides along with it: a host that materializes artefacts from a
// geometry of its own — a file, a generator, another editor's board — fits their
// labels the way the importer does, rather than reinventing the arithmetic.
export {
  bpmnLabelFit,
  type BpmnLabelFit,
  bpmnMorphClears,
  bpmnMorphProps,
  bpmnNodeProps,
  type BpmnNodePreset,
  NODE_PRESETS,
} from './presets.js';
// What an artefact may BECOME: the declared families, and the spec the generic
// morph module is registered with. Data a host can read without an editor.
export { BPMN_MORPH_FAMILIES, BPMN_MORPH_SPEC } from './morph.js';
// BPMN's entries in the interchange registry (`docs/adr/0012`) — `.bpmn` out,
// `.bpmn` in, and the visual-tier SVG fallback. Exported whole so a host can
// ask what BPMN can read and write without mounting an editor, and call it
// without one either.
export {
  BPMN_INTERCHANGE,
  BPMN_SVG_FORMAT,
  BPMN_SVG_IMPORT,
  BPMN_XML_EXPORT,
  BPMN_XML_EXTENSION,
  BPMN_XML_IMPORT,
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
