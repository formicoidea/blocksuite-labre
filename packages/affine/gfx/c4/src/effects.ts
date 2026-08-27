import { EdgelessC4Menu } from './toolbar/c4-menu';
import { EdgelessC4SeniorButton } from './toolbar/c4-senior-button';
import { C4NodeDetailsPanel } from './toolbar/node-details';

export function effects() {
  customElements.define('edgeless-c4-menu', EdgelessC4Menu);
  customElements.define('edgeless-c4-senior-button', EdgelessC4SeniorButton);
}

/**
 * The custom elements the ALWAYS-ON half needs.
 *
 * Separate from {@link effects} because the split is the one `docs/adr/0009`
 * draws: the senior button and its menu are tooling and go away with the flag,
 * while the node's Details popover edits an element that is already in the
 * document and must keep working when it does. Defining a tag twice throws, so
 * each definition belongs to exactly one of the two.
 */
export function renderEffects() {
  customElements.define('c4-node-details-panel', C4NodeDetailsPanel);
}

declare global {
  interface HTMLElementTagNameMap {
    'edgeless-c4-menu': EdgelessC4Menu;
    'edgeless-c4-senior-button': EdgelessC4SeniorButton;
    'c4-node-details-panel': C4NodeDetailsPanel;
  }
}
