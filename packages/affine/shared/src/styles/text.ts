import type { StyleInfo } from 'lit/directives/style-map.js';

import type { AffineTextAttributes } from '../types';

export function affineTextStyles(
  props: AffineTextAttributes,
  override?: Readonly<StyleInfo>
): StyleInfo {
  const textDecorations = [
    props.underline && 'underline',
    props.overline && 'overline',
    props.strike && 'line-through',
  ]
    .filter(Boolean)
    .join(' ');

  let inlineCodeStyle = {};
  if (props.code) {
    inlineCodeStyle = {
      'font-family': 'var(--affine-font-code-family)',
      background: 'var(--affine-background-code-block)',
      border: '1px solid var(--affine-border-color)',
      'border-radius': '4px',
      color: 'var(--affine-text-primary-color)',
      'font-variant-ligatures': 'none',
      'vertical-align': 'bottom',
      'line-height': 'inherit',
    };
  }

  return {
    'font-weight': props.bold ? 'bolder' : 'inherit',
    'font-style': props.italic ? 'italic' : 'normal',
    'background-color': props.background ? props.background : undefined,
    color: props.color ? props.color : undefined,
    'text-decoration': textDecorations.length > 0 ? textDecorations : 'none',
    ...inlineCodeStyle,
    ...override,
  };
}
