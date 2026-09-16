import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { describe, expect, test } from 'vitest';

import { EdgelessCRUDIdentifier } from '../extensions/crud-extension.js';
import { recordAction } from '../extensions/record-action.js';

/**
 * The recording fake behind both the derived templates and the artefact
 * placement ghost: run a creation action against nothing, and learn what it
 * would have drawn.
 */

const gfxOf = (std: BlockStdScope) =>
  std.get(GfxControllerIdentifier) as unknown as {
    surface: {
      addElement: (props: Record<string, unknown>) => string;
      getElementById: (id: string) => Record<string, unknown> | null;
    };
    viewport: { centerX: number; centerY: number };
  };

describe('recordAction', () => {
  test('a run that adds two elements yields two records and the union bound', () => {
    const { records, bound } = recordAction(std => {
      const gfx = gfxOf(std);
      gfx.surface.addElement({ type: 'shape', xywh: '[-60,-30,120,60]' });
      gfx.surface.addElement({ type: 'text', xywh: '[0,40,80,20]' });
    });

    expect(records).toHaveLength(2);
    expect(records.map(record => record['type'])).toEqual(['shape', 'text']);
    expect(bound?.serialize()).toBe('[-60,-30,140,90]');
  });

  test('the fake viewport centre is the origin, so the bound is a footprint', () => {
    const { bound } = recordAction(std => {
      const gfx = gfxOf(std);
      const { centerX, centerY } = gfx.viewport;
      gfx.surface.addElement({
        type: 'shape',
        xywh: `[${centerX - 50},${centerY - 25},100,50]`,
      });
    });

    expect(bound?.serialize()).toBe('[-50,-25,100,50]');
  });

  test('a record is readable back, and props left undefined are dropped', () => {
    const { records } = recordAction(std => {
      const gfx = gfxOf(std);
      const id = gfx.surface.addElement({
        type: 'shape',
        xywh: '[0,0,10,10]',
        radius: undefined,
      });
      // What a placement action does next: read the model back off the surface.
      expect(gfx.surface.getElementById(id)?.['type']).toBe('shape');
    });

    expect(records[0]).not.toHaveProperty('radius');
    // `index` is filled in so the drawing keeps the order it was created in.
    expect(records[0]['index']).toBeTypeOf('string');
  });

  test('the CRUD seam records too, and `encode` rewrites a record before it is kept', () => {
    const { records } = recordAction(
      std => {
        const crud = std.get(EdgelessCRUDIdentifier) as unknown as {
          addElement: (type: string, props: Record<string, unknown>) => string;
        };
        crud.addElement('shape', { xywh: '[0,0,10,10]', text: 'hello' });
      },
      { encode: record => void (record['text'] = `<${record['text']}>`) }
    );

    expect(records[0]['type']).toBe('shape');
    expect(records[0]['text']).toBe('<hello>');
  });

  test('a service the fake does not answer throws, naming itself', () => {
    expect(() =>
      recordAction(std => {
        std.get({ identifierName: 'ThemeProvider' } as never);
      })
    ).toThrow(/recordAction: unsupported service "ThemeProvider"/);
  });

  test('an action that draws nothing yields no bound rather than an empty box', () => {
    const { records, bound } = recordAction(() => {});

    expect(records).toEqual([]);
    expect(bound).toBeNull();
  });
});
