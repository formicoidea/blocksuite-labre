// The declaration IS the pool: what it looks like, where its plot is and how
// its lanes divide that plot are all read off this one value (`docs/adr/0009`
// on why a framework declares rather than draws). Exported so a host — and the
// audit's own consumers — can answer those questions without a canvas.
export { BPMN_POOL_BACKGROUND } from './background.js';
export { bpmnCommandIcons, bpmnCommands } from './commands';
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
