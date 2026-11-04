/**
 * The HTML export writes a highlight colour only from a `--` token.
 *
 * What it would have caught: the part of a stored colour between `var(` and `)`
 * copied into the `style` string of the exported `<mark>`, where a `;` declares
 * another property in the file a reader exports or copies. A token keeps its
 * colour, in the form `ThemeService.getCssVariableColor` hands back.
 */
import { InlineDeltaToHtmlAdapterMatcherIdentifier } from '@labre/affine-shared/adapters';
import type { ServiceProvider } from '@labre/global/di';
import { describe, expect, test } from 'vitest';

import { getProvider } from '../utils/get-provider.js';

const TOKEN_VALUE = '#123456';
// What the theme service does: a `--` name is looked up, the rest comes back.
const theme = {
  getCssVariableColor: (name: string) =>
    name.startsWith('--') ? TOKEN_VALUE : name,
};
const themed = { getOptional: () => theme } as unknown as ServiceProvider;

function styleOf(matcher: string, attributes: Record<string, string>) {
  const { toAST } = getProvider().get(
    InlineDeltaToHtmlAdapterMatcherIdentifier(matcher)
  );
  const current = { type: 'text' as const, value: 'run' };
  const delta = { insert: 'run', attributes: attributes as never };
  const ast = toAST(delta, { current } as never, themed);
  return (ast as { properties?: { style?: string } }).properties?.style;
}

describe.each([
  ['highlight-color', 'color', `color: ${TOKEN_VALUE};`],
  ['highlight-background', 'background', `background-color: ${TOKEN_VALUE};`],
])('%s', (matcher, attribute, written) => {
  test('a token is written as its colour', () => {
    const style = styleOf(matcher, {
      [attribute]: 'var(--affine-text-highlight-red)',
    });
    expect(style).toContain(written);
  });

  test('anything else declares nothing', () => {
    const style = styleOf(matcher, {
      [attribute]: 'var(red;outline-style:dotted)',
    });
    expect(style ?? '').not.toContain('outline-style');
  });
});
