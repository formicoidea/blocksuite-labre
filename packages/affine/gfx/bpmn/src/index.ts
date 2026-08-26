// The declaration IS the pool: what it looks like, where its plot is and how
// its lanes divide that plot are all read off this one value (`docs/adr/0009`
// on why a framework declares rather than draws). Exported so a host — and the
// audit's own consumers — can answer those questions without a canvas.
export { BPMN_POOL_BACKGROUND } from './background.js';
export { bpmnCommandIcons, bpmnCommands } from './commands';
export {
  BPMN_ROLE,
  BPMN_ROLE_OF_KIND,
  BPMN_ROLES,
  type BpmnRole,
  type BpmnRoleId,
} from './roles.js';
export { bpmnTranslationEntries } from './translations.js';
