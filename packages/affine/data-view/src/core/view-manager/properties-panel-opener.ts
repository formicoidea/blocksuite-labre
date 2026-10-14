import { createIdentifier } from '@labre/global/di';

/**
 * Set on a data source (`serviceSet`) by the block that hosts its views when
 * the editor has a properties panel (ADR 0035 §9b, issue B10): the view
 * options' "Properties" then opens that panel on the view instead of the
 * popover. Absent, the popover, as in 0.48: the only way back to a hidden
 * property must always exist, and here it is the panel or the popover.
 */
export const PropertiesPanelOpenerKey = createIdentifier<
  (viewId: string) => void
>('data-view-properties-panel-opener');
