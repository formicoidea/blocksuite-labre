import { EdgelessDddContextMapMenu } from './toolbar/context-map-menu';
import { EdgelessDddCoreDomainMenu } from './toolbar/core-domain-menu';
import { EdgelessDddEventStormingMenu } from './toolbar/event-storming-menu';
import {
  EdgelessDddContextMapSeniorButton,
  EdgelessDddCoreDomainSeniorButton,
  EdgelessDddEventStormingSeniorButton,
} from './toolbar/senior-buttons';

/** Define a custom element once (each tool's effect may run more than once). */
function define(tag: string, ctor: CustomElementConstructor) {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

export function eventStormingEffects() {
  define('edgeless-ddd-event-storming-menu', EdgelessDddEventStormingMenu);
  define(
    'edgeless-ddd-event-storming-senior-button',
    EdgelessDddEventStormingSeniorButton
  );
}

export function coreDomainEffects() {
  define('edgeless-ddd-core-domain-menu', EdgelessDddCoreDomainMenu);
  define(
    'edgeless-ddd-core-domain-senior-button',
    EdgelessDddCoreDomainSeniorButton
  );
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
    'edgeless-ddd-event-storming-menu': EdgelessDddEventStormingMenu;
    'edgeless-ddd-event-storming-senior-button': EdgelessDddEventStormingSeniorButton;
    'edgeless-ddd-core-domain-menu': EdgelessDddCoreDomainMenu;
    'edgeless-ddd-core-domain-senior-button': EdgelessDddCoreDomainSeniorButton;
    'edgeless-ddd-context-map-menu': EdgelessDddContextMapMenu;
    'edgeless-ddd-context-map-senior-button': EdgelessDddContextMapSeniorButton;
  }
}
