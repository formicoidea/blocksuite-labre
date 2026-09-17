/**
 * The automatic legend MOVED to `@labre/affine-block-surface`
 * (`extensions/legend.ts`), the neutral home the validation engine already
 * lives in: BPMN and Wardley document themselves with the same engine and must
 * not depend on a DDD bundle to do it.
 *
 * What stays here is the import path the five frameworks and UML already
 * write, re-exported unchanged so not one of them had to be touched by the
 * move. It goes away once the last of them subscribes its rows on its commands
 * (`CommandDescriptor.legend`) and reads `createBoardLegend` instead.
 *
 * @deprecated Import from `@labre/affine-block-surface`.
 */
export {
  autoLegendSections,
  createAutoLegend,
  roleLabel,
  rolesInBound,
  type AutoLegendEntry,
  type AutoLegendSectionSpec,
  type AutoLegendSpec,
} from '@labre/affine-block-surface';
