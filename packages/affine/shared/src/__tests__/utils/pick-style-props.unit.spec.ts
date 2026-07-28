import { describe, expect, test } from 'vitest';

import { pickStylePropsForKey } from '../../utils/zod-schema.js';

describe('pickStylePropsForKey', () => {
  test('a fill picked on a rect applies to an ellipse', () => {
    expect(
      pickStylePropsForKey('shape:ellipse', {
        fillColor: '--affine-palette-shape-yellow',
      })
    ).toEqual({ fillColor: '--affine-palette-shape-yellow' });
  });

  test('a font style set on a text applies to a shape', () => {
    expect(
      pickStylePropsForKey('shape:rect', {
        fontStyle: 'italic',
        fontWeight: '600',
      })
    ).toEqual({ fontStyle: 'italic', fontWeight: '600' });
  });

  test('props foreign to the target are dropped without discarding the rest', () => {
    expect(
      pickStylePropsForKey('text', {
        fillColor: '--affine-palette-shape-yellow', // shapes only
        lineWidth: 4, // brush only
        color: '--affine-palette-line-red',
        fontSize: 24,
      })
    ).toEqual({ color: '--affine-palette-line-red', fontSize: 24 });
  });

  test('returns null when nothing applies', () => {
    expect(
      pickStylePropsForKey('text', {
        fillColor: '--affine-palette-shape-yellow',
      })
    ).toBeNull();
  });

  test('an invalid value for a known prop is dropped', () => {
    expect(pickStylePropsForKey('shape:rect', { fontSize: 'big' })).toBeNull();
  });
});
