import { EdgelessFrameManagerIdentifier } from '@labre/affine-block-frame';
import { EdgelessCRUDExtension } from '@labre/affine-block-surface';
import { TranslationProvider } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import type { ExtensionType } from '@labre/store';
import { describe, expect, it } from 'vitest';

import { SurfaceRefSlashMenuConfigExtension } from '../configs/slash-menu';

/** Reach the config object a `SlashMenuConfigExtension` wraps, without DI. */
function configOf(extension: ExtensionType) {
  let captured: unknown;
  extension.setup({
    addImpl: (_id: unknown, config: unknown) => {
      captured = config;
    },
  } as unknown as Parameters<ExtensionType['setup']>[0]);
  return captured as {
    items: (ctx: {
      std: BlockStdScope;
      model: unknown;
    }) => { name: string; action: () => void }[];
  };
}

/**
 * The "/ Mind Map" slash-menu entry's root and child captions are SEEDS:
 * resolved at PLACEMENT and never again (ADR 0016).
 */
describe('the "/ Mind Map" slash command names the mindmap through the seam', () => {
  function fakeStd(t?: (key: string) => string | undefined) {
    let captured: { children: unknown } | undefined;
    const std = {
      get: (id: unknown) => {
        if (id === EdgelessCRUDExtension) {
          return {
            addElement: (_type: string, props: Record<string, unknown>) => {
              captured = props as { children: unknown };
              return 'mindmap-id';
            },
            getElementsByType: () => [],
          };
        }
        if (id === EdgelessFrameManagerIdentifier) {
          return { frames: [] };
        }
        if (id === GfxControllerIdentifier) {
          return { grid: { search: () => [] } };
        }
        throw new Error(`unexpected get(${String(id)})`);
      },
      getOptional: (id: unknown) =>
        id === TranslationProvider && t ? { t } : undefined,
      command: {
        // Short-circuits `insertSurfaceRefAndSelect` before it touches
        // selection — nothing under test happens past this point.
        exec: () => [undefined, { insertedSurfaceRefBlockId: undefined }],
      },
    } as unknown as BlockStdScope;
    return { std, childrenOf: () => captured?.children };
  }

  function runInsertMindMap(std: BlockStdScope) {
    const config = configOf(SurfaceRefSlashMenuConfigExtension);
    const items = config.items({ std, model: {} });
    const item = items.find(i => i.name === 'Mind Map');
    if (!item) throw new Error('no "Mind Map" slash item');
    item.action();
  }

  it('without a provider, the root and children are English', () => {
    const { std, childrenOf } = fakeStd();
    runInsertMindMap(std);
    const children = childrenOf() as {
      text: string;
      children: { text: string }[];
    };
    expect(children.text).toBe('Mind Map');
    expect(children.children.map(c => c.text)).toEqual([
      'Text',
      'Text',
      'Text',
    ]);
  });

  it('with a fake provider, the root and children are translated', () => {
    const fr: Record<string, string> = {
      'com.labre.surface-ref.seed.mindmap-root': 'Carte mentale',
      'com.labre.surface-ref.seed.mindmap-node': 'Texte',
    };
    const { std, childrenOf } = fakeStd(k => fr[k]);
    runInsertMindMap(std);
    const children = childrenOf() as {
      text: string;
      children: { text: string }[];
    };
    expect(children.text).toBe('Carte mentale');
    expect(children.children.map(c => c.text)).toEqual([
      'Texte',
      'Texte',
      'Texte',
    ]);
  });
});
