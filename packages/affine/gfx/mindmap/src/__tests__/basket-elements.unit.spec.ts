import { EdgelessCRUDIdentifier } from '@labre/affine-block-surface';
import { TranslationProvider } from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import type { BlockComponent, BlockStdScope } from '@labre/std';
import { MindmapStyle } from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import { getMindmapRender } from '../toolbar/basket-elements';

/**
 * The drag-from-basket mindmap tool writes the same two seeds the starter
 * templates do (`com.labre.mindmap.seed.root` / `.child`): resolved at
 * PLACEMENT and never again (ADR 0016).
 */
describe('dragging the mindmap basket tool names the mindmap through the seam', () => {
  function fakeEdgeless(
    t?: (key: string) => string | undefined
  ): BlockComponent {
    const std = {
      get: (id: unknown) => {
        if (id === EdgelessCRUDIdentifier) {
          return {
            addElement: (_type: string, props: Record<string, unknown>) =>
              props,
          };
        }
        throw new Error(`unexpected get(${String(id)})`);
      },
      getOptional: (id: unknown) =>
        id === TranslationProvider && t ? { t } : undefined,
    } as unknown as BlockStdScope;
    return { std } as unknown as BlockComponent;
  }

  it('without a provider, the root and children are English', async () => {
    const render = getMindmapRender(MindmapStyle.ONE);
    const mindmap = (await render(
      new Bound(0, 0, 200, 200),
      fakeEdgeless()
    )) as unknown as {
      children: string;
    } | null;
    // `addElement` here just echoes its props back — the mindmap's own
    // `children` tree is the thing under test.
    const props = mindmap as unknown as {
      children: { text: string; children: { text: string }[] };
    };
    expect(props.children.text).toBe('Mind Map');
    expect(props.children.children.map(c => c.text)).toEqual([
      'Text',
      'Text',
      'Text',
    ]);
  });

  it('with a fake provider, the root and children are translated', async () => {
    const fr: Record<string, string> = {
      'com.labre.mindmap.seed.root': 'Carte mentale',
      'com.labre.mindmap.seed.child': 'Texte',
    };
    const render = getMindmapRender(MindmapStyle.ONE);
    const mindmap = await render(
      new Bound(0, 0, 200, 200),
      fakeEdgeless(k => fr[k])
    );
    const props = mindmap as unknown as {
      children: { text: string; children: { text: string }[] };
    };
    expect(props.children.text).toBe('Carte mentale');
    expect(props.children.children.map(c => c.text)).toEqual([
      'Texte',
      'Texte',
      'Texte',
    ]);
  });
});
