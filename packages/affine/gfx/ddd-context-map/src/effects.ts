import { EdgelessDddContextMapMenu } from './toolbar/context-map-menu';
import { EdgelessDddContextMapSeniorButton } from './toolbar/senior-button';

/** Define a custom element once (each tool's effect may run more than once). */
function define(tag: string, ctor: CustomElementConstructor) {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

export function contextMapEffects() {
  define('edgeless-ddd-context-map-menu', EdgelessDddContextMapMenu);
  define(
    'edgeless-ddd-context-map-senior-button',
    EdgelessDddContextMapSeniorButton
  );
}

declare global {
  interface HTMLElementTagNameMap {
    'edgeless-ddd-context-map-menu': EdgelessDddContextMapMenu;
    'edgeless-ddd-context-map-senior-button': EdgelessDddContextMapSeniorButton;
  }
}
