import type { Constructor } from '@labre/global/utils';
import type { CSSResultGroup, CSSResultOrNative } from 'lit';
import { CSSResult, LitElement } from 'lit';

/**
 * Every light-DOM style registered so far, so a host can move them to adopted
 * style sheets after the classes were finalized (most are, at import time).
 */
const registeredStyles: CSSResult[] = [];

let adoptStyles = false;

const sheetsOf = (styles: readonly CSSResult[]): CSSStyleSheet[] =>
  styles
    .map(style => style.styleSheet)
    .filter((sheet): sheet is CSSStyleSheet => sheet !== undefined);

/**
 * Light-DOM styles go to `document.adoptedStyleSheets` from now on, and the
 * ones already registered follow them there. A Content-Security-Policy whose
 * `style-src` has no `'unsafe-inline'` blocks every `<style>` element, so
 * without this nothing the library draws is styled; constructed style sheets
 * are not subject to it. The canvas viewer calls it (ADR 0050, a public page);
 * the editor keeps `<style>` elements and its cascade order. Idempotent.
 */
export function adoptShadowlessStyles(): void {
  if (adoptStyles || typeof document === 'undefined') return;
  adoptStyles = true;
  document.adoptedStyleSheets = [
    ...document.adoptedStyleSheets,
    ...sheetsOf(registeredStyles),
  ];
}

export class ShadowlessElement extends LitElement {
  // Map of the number of styles injected into a node
  // A reference count of the number of ShadowlessElements that are still connected
  static connectedCount = new WeakMap<
    Constructor, // class
    WeakMap<Node, number>
  >();

  static onDisconnectedMap = new WeakMap<
    Constructor, // class
    WeakMap<Node, (() => void) | null>
  >();

  // styles registered in ShadowlessElement will be available globally
  // even if the element is not being rendered
  protected static override finalizeStyles(
    styles?: CSSResultGroup
  ): CSSResultOrNative[] {
    const elementStyles = super.finalizeStyles(styles);
    // XXX: This breaks component encapsulation and applies styles to the document.
    // These styles should be manually scoped.
    const results = elementStyles.filter(
      (s): s is CSSResult => s instanceof CSSResult
    );
    registeredStyles.push(...results);
    if (typeof document === 'undefined') return elementStyles;
    if (adoptStyles) {
      document.adoptedStyleSheets = [
        ...document.adoptedStyleSheets,
        ...sheetsOf(results),
      ];
      return elementStyles;
    }
    results.forEach(s => {
      const style = document.createElement('style');
      style.textContent = s.cssText;
      document.head.append(style);
    });
    return elementStyles;
  }

  private getConnectedCount() {
    const SE = this.constructor as typeof ShadowlessElement;
    return SE.connectedCount.get(SE)?.get(this.getRootNode()) ?? 0;
  }

  private setConnectedCount(count: number) {
    const SE = this.constructor as typeof ShadowlessElement;

    if (!SE.connectedCount.has(SE)) {
      SE.connectedCount.set(SE, new WeakMap());
    }

    SE.connectedCount.get(SE)?.set(this.getRootNode(), count);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const parentRoot = this.getRootNode();
    const SE = this.constructor as typeof ShadowlessElement;
    const insideShadowRoot = parentRoot instanceof ShadowRoot;
    const styleInjectedCount = this.getConnectedCount();

    if (styleInjectedCount === 0 && insideShadowRoot && adoptStyles) {
      const sheets = sheetsOf(
        SE.elementStyles.filter((s): s is CSSResult => s instanceof CSSResult)
      );
      parentRoot.adoptedStyleSheets = [
        ...parentRoot.adoptedStyleSheets,
        ...sheets,
      ];
      if (!SE.onDisconnectedMap.has(SE)) {
        SE.onDisconnectedMap.set(SE, new WeakMap());
      }
      SE.onDisconnectedMap.get(SE)?.set(parentRoot, () => {
        // One occurrence per sheet: a class sharing a `css` result with this
        // one adopted its own copy, and keeps it.
        const adopted = [...parentRoot.adoptedStyleSheets];
        sheets.forEach(sheet => {
          const at = adopted.indexOf(sheet);
          if (at >= 0) adopted.splice(at, 1);
        });
        parentRoot.adoptedStyleSheets = adopted;
      });
    } else if (styleInjectedCount === 0 && insideShadowRoot) {
      const elementStyles = SE.elementStyles;
      const injectedStyles: HTMLStyleElement[] = [];
      elementStyles.forEach((s: CSSResultOrNative) => {
        if (s instanceof CSSResult && typeof document !== 'undefined') {
          const style = document.createElement('style');
          style.textContent = s.cssText;
          parentRoot.prepend(style);
          injectedStyles.push(style);
        }
      });
      if (!SE.onDisconnectedMap.has(SE)) {
        SE.onDisconnectedMap.set(SE, new WeakMap());
      }
      SE.onDisconnectedMap.get(SE)?.set(parentRoot, () => {
        injectedStyles.forEach(style => style.remove());
      });
    }
    this.setConnectedCount(styleInjectedCount + 1);
  }

  override createRenderRoot() {
    return this;
  }

  override disconnectedCallback(): void {
    const parentRoot = this.getRootNode();
    super.disconnectedCallback();
    const SE = this.constructor as typeof ShadowlessElement;
    let styleInjectedCount = this.getConnectedCount();
    styleInjectedCount--;
    this.setConnectedCount(styleInjectedCount);

    if (styleInjectedCount === 0) {
      // remove the style element when the last shadowless element is disconnected in the parent root
      SE.onDisconnectedMap.get(SE)?.get(parentRoot)?.();
    }
  }
}
