import { EdgelessC4Menu } from './toolbar/c4-menu';
import { EdgelessC4SeniorButton } from './toolbar/c4-senior-button';

export function effects() {
  customElements.define('edgeless-c4-menu', EdgelessC4Menu);
  customElements.define('edgeless-c4-senior-button', EdgelessC4SeniorButton);
}

declare global {
  interface HTMLElementTagNameMap {
    'edgeless-c4-menu': EdgelessC4Menu;
    'edgeless-c4-senior-button': EdgelessC4SeniorButton;
  }
}
