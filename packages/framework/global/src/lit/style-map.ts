import { type AttributePart, noChange } from 'lit';
import {
  Directive,
  directive,
  type PartInfo,
  PartType,
} from 'lit/directive.js';
import type { StyleInfo } from 'lit/directives/style-map.js';

export type { StyleInfo };

const IMPORTANT_FLAG = ' !important';

// Lit's own: the gap before each capital, with a leading vendor prefix taken in.
// Matches before "C" in "backgroundColor" and "webkitA" in "webkitAppearance";
// matches nothing that changes "color".
// https://regex101.com/?regex=%28%3F%3A%5E%28webkit%7Cmoz%7Cms%7Co%29%7C%29%28%3F%3D%5BA-Z%5D%29&flags=g&testString=webkitAppearance
const CAMEL_CASE_BOUNDARY = /(?:^(webkit|moz|ms|o)|)(?=[A-Z])/g;

const toCssName = (name: string) =>
  name.includes('-')
    ? name
    : name.replace(CAMEL_CASE_BOUNDARY, '-$&').toLowerCase();

class StyleMapDirective extends Directive {
  private readonly _applied = new Map<string, string>();

  constructor(partInfo: PartInfo) {
    super(partInfo);
    const { type, name, strings } = partInfo as PartInfo & {
      name?: string;
      strings?: readonly string[];
    };
    // A static part beside it would be committed over what `update` applied.
    if (
      type !== PartType.ATTRIBUTE ||
      name !== 'style' ||
      (strings && strings.join('') !== '')
    ) {
      throw new Error('styleMap must be the only part of a style attribute.');
    }
  }

  render(_styleInfo: Readonly<StyleInfo>) {
    return noChange;
  }

  override update(part: AttributePart, [styleInfo]: [Readonly<StyleInfo>]) {
    const { style } = part.element as HTMLElement;
    [...this._applied.keys()]
      .filter(name => styleInfo[name] == null)
      .forEach(name => {
        this._applied.delete(name);
        style.removeProperty(toCssName(name));
      });
    Object.entries(styleInfo)
      .filter(([, value]) => value != null)
      .forEach(([name, raw]) => {
        const value = String(raw);
        const cssName = toCssName(name);
        const important = value.endsWith(IMPORTANT_FLAG);
        // A new value clears the old one first: if the browser refuses it, the
        // property falls back to the stylesheet instead of keeping the old value.
        if (this._applied.get(name) !== value) style.removeProperty(cssName);
        this._applied.set(name, value);
        style.setProperty(
          cssName,
          important ? value.slice(0, -IMPORTANT_FLAG.length) : value,
          important ? 'important' : ''
        );
      });
    return noChange;
  }
}

/**
 * Lit's `styleMap`, minus its first render. Lit joins the values of the first
 * render into one `style` string, so a value holding a `;` adds declarations of
 * its own; and those values are colours, sizes and names that any client writing
 * to the document fills as it likes. This one hands every value to the CSSOM, as
 * Lit does on every later render: one value for one property, the browser refuses
 * the rest. A refused value leaves the property unset. Nothing here reads what
 * the value means, so a token, `var()`, `rgb()` or `oklch()` passes as before.
 *
 * `style-map-boundary.unit.spec.ts` holds that no package imports Lit's.
 */
export const styleMap = directive(StyleMapDirective);

// Named for the declarations of every class whose render result carries this type.
export type { StyleMapDirective };
