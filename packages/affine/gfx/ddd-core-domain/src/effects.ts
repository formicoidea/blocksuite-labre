import { EdgelessDddCoreDomainMenu } from './toolbar/core-domain-menu';
import { EdgelessDddCoreDomainSeniorButton } from './toolbar/senior-button';

/** Define a custom element once (each tool's effect may run more than once). */
function define(tag: string, ctor: CustomElementConstructor) {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

export function coreDomainEffects() {
  define('edgeless-ddd-core-domain-menu', EdgelessDddCoreDomainMenu);
  define(
    'edgeless-ddd-core-domain-senior-button',
    EdgelessDddCoreDomainSeniorButton
  );
}

declare global {
  interface HTMLElementTagNameMap {
    'edgeless-ddd-core-domain-menu': EdgelessDddCoreDomainMenu;
    'edgeless-ddd-core-domain-senior-button': EdgelessDddCoreDomainSeniorButton;
  }
}
