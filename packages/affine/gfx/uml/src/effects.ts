import { EdgelessUmlMenu } from './toolbar/uml-menu.js';
import { EdgelessUmlSeniorButton } from './toolbar/uml-senior-button.js';

export function effects() {
  customElements.define('edgeless-uml-menu', EdgelessUmlMenu);
  customElements.define('edgeless-uml-senior-button', EdgelessUmlSeniorButton);
}

declare global {
  interface HTMLElementTagNameMap {
    'edgeless-uml-menu': EdgelessUmlMenu;
    'edgeless-uml-senior-button': EdgelessUmlSeniorButton;
  }
}
