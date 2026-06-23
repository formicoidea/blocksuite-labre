import { GfxViewportElement } from './gfx/viewport-element.js';
import { VElement, VLine, VText } from './inline/index.js';
import { EditorHost } from './view/index.js';

export function effects() {
  // editor host
  define('editor-host', EditorHost);
  // gfx
  define('gfx-viewport', GfxViewportElement);
  // inline
  define('v-element', VElement);
  define('v-line', VLine);
  define('v-text', VText);
}

// ponytail: idempotent so effects() can run more than once (e.g. across browser
// unit-test files sharing a registry) without throwing on re-registration.
function define(name: string, ctor: CustomElementConstructor) {
  if (!customElements.get(name)) {
    customElements.define(name, ctor);
  }
}
