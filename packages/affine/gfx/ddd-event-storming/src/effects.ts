import { EdgelessDddEventStormingMenu } from './toolbar/event-storming-menu';
import { EdgelessDddEventStormingSeniorButton } from './toolbar/senior-button';

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

declare global {
  interface HTMLElementTagNameMap {
    'edgeless-ddd-event-storming-menu': EdgelessDddEventStormingMenu;
    'edgeless-ddd-event-storming-senior-button': EdgelessDddEventStormingSeniorButton;
  }
}
