import {
  EditPropsStore,
  TranslationProvider,
} from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import type { Text } from '@labre/store';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { EdgelessFrameManager } from '../frame-manager';

/** A standalone Y.Text reads empty until integrated; integrate to read it. */
function materialize(text: Text): string {
  if (!text.yText.doc) new Y.Doc().getMap('m').set('t', text.yText);
  return text.toString();
}

/**
 * A frame's default title (`Frame {{n}}`) is a SEED: text a creation action
 * writes INTO the document, resolved at PLACEMENT and never again (ADR 0016).
 */
describe('a placed frame is named through the translation seam', () => {
  function fakeGfx(
    existingFrames: number,
    t?: (key: string, params?: Record<string, string | number>) => string
  ) {
    let addedProps: Record<string, unknown> | undefined;
    const std = {
      get: (id: unknown) => {
        if (id === EditPropsStore) {
          return {
            applyLastProps: (
              _flavour: string,
              props: Record<string, unknown>
            ) => props,
          };
        }
        throw new Error(`unexpected get(${String(id)})`);
      },
      getOptional: (id: unknown) =>
        id === TranslationProvider && t ? { t } : undefined,
    } as unknown as BlockStdScope;

    const frameModel = { flavour: 'affine:frame' };
    const noopSubscribable = { subscribe: () => ({ unsubscribe() {} }) };
    const gfx = {
      std,
      surface: { elementAdded: noopSubscribable },
      layer: { layers: [], generateIndex: () => 'a1' },
      doc: {
        addBlock: (
          _flavour: string,
          props: Record<string, unknown>,
          _parent: unknown
        ) => {
          addedProps = props;
          return 'frame-id';
        },
        blocks: {
          value: Object.fromEntries(
            Array.from({ length: existingFrames }, (_, i) => [
              `f${i}`,
              {
                model: {
                  flavour: 'affine:frame',
                  props: { presentationIndex: `a${i}`, index: `a${i}` },
                },
              },
            ])
          ),
        },
        slots: { blockUpdated: noopSubscribable },
      },
      getElementById: () => frameModel,
    };

    return {
      manager: new EdgelessFrameManager(gfx as never),
      titleOf: () => materialize(addedProps?.['title'] as Text),
    };
  }

  it('without a provider, names the frame in English with the right ordinal', () => {
    const { manager, titleOf } = fakeGfx(2);
    (
      manager as unknown as { _addFrameBlock: (b: Bound) => unknown }
    )._addFrameBlock(new Bound(0, 0, 100, 100));
    expect(titleOf()).toBe('Frame 3');
  });

  it('with a fake provider, the title is translated and the param filled', () => {
    const { manager, titleOf } = fakeGfx(0, (key, params) =>
      key === 'com.labre.frame.seed.name' ? `Cadre ${params?.['n']}` : ''
    );
    (
      manager as unknown as { _addFrameBlock: (b: Bound) => unknown }
    )._addFrameBlock(new Bound(0, 0, 100, 100));
    expect(titleOf()).toBe('Cadre 1');
  });
});
