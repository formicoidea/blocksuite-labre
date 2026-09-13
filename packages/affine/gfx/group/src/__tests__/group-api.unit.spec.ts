import { EdgelessCRUDIdentifier } from '@labre/affine-block-surface';
import { TranslationProvider } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { createGroupCommand } from '../command/group-api';

/**
 * A group's default title (`Group {{n}}`) is a SEED: text a creation action
 * writes INTO the document, resolved at PLACEMENT and never again (ADR 0016).
 */
describe('createGroupCommand names the group through the translation seam', () => {
  function fakeStd(
    existingGroups: number,
    t?: (key: string, params?: Record<string, string | number>) => string
  ) {
    let created: { type: string; props: Record<string, unknown> } | undefined;
    const std = {
      get: (id: unknown) => {
        if (id === GfxControllerIdentifier) {
          return {
            layer: {
              canvasElements: Array.from({ length: existingGroups }, () => ({
                type: 'group',
              })),
            },
          };
        }
        if (id === EdgelessCRUDIdentifier) {
          return {
            addElement: (type: string, props: Record<string, unknown>) => {
              created = { type, props };
              return 'group-id';
            },
          };
        }
        throw new Error(`unexpected get(${String(id)})`);
      },
      getOptional: (id: unknown) =>
        id === TranslationProvider && t ? { t } : undefined,
    } as unknown as BlockStdScope;
    return { std, createdTitle: () => created?.props['title'] };
  }

  it('without a provider, names the group in English with the right ordinal', () => {
    const { std, createdTitle } = fakeStd(2);
    let result: { groupId: string } | undefined;
    createGroupCommand({ std, elements: [] } as never, r => {
      result = r as { groupId: string };
    });
    expect(result?.groupId).toBe('group-id');
    expect(createdTitle()).toBe('Group 3');
  });

  it('with a fake provider, the title is translated and the param filled', () => {
    const { std, createdTitle } = fakeStd(0, (key, params) =>
      key === 'com.labre.group.seed.name' ? `Groupe ${params?.['n']}` : ''
    );
    createGroupCommand({ std, elements: [] } as never, () => {});
    expect(createdTitle()).toBe('Groupe 1');
  });
});
