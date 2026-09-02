export { activateMovement, createCoreDomainChart } from './actions.js';
export { coreDomainCommandIcons, coreDomainCommands } from './commands.js';
export { coreDomainTranslationEntries } from './translations.js';
export {
  CORE_DOMAIN_BACKGROUND,
  CORE_DOMAIN_LEGEND_TONES,
} from './core-domain/background.js';
export { coreDomain } from './core-domain/element-renderer.js';
// The morph: the families the dropdown is parameterized by, the resolution from
// a selected group to the shape the role lives on, the patch a kind is worth,
// and the caption rule — all of them what the unit and integration suites drive.
export {
  CORE_DOMAIN_MORPH_FAMILIES,
  CORE_DOMAIN_MORPH_SPEC,
  coreDomainArtefactOf,
  coreDomainMorphClears,
  coreDomainMorphedCaption,
  coreDomainMorphProps,
  type CdMorphKind,
} from './morph.js';
export { CORE_DOMAIN_NUDGES } from './nudges.js';
export { CORE_DOMAIN_PROFILES } from './profiles.js';
export {
  CORE_DOMAIN_ROLE,
  CORE_DOMAIN_ROLES,
  type CoreDomainRole,
  type CoreDomainRoleId,
  subdomainRole,
} from './roles.js';
export { CORE_DOMAIN_RULES } from './rules.js';
export { coreDomainTemplateCategory } from './templates.js';
export { coreDomainSeniorTool } from './toolbar/senior-tool.js';
export { EdgelessDddCoreDomainSeniorButton } from './toolbar/senior-button.js';
export {
  DddCoreDomainRenderViewExtension,
  DddCoreDomainViewExtension,
} from './view.js';
