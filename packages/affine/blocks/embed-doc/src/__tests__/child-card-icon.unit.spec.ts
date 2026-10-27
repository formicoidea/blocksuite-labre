import {
  DocDisplayMetaProvider,
  TitleBandProvider,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { computed, signal } from '@preact/signals-core';
import { html } from 'lit';
import { describe, expect, it, vi } from 'vitest';

import { cardIcon, isChildCard } from '../common/child-card';

/**
 * A child page's own card is not a reference (labre recette 3 P2-7c,
 * ADR-0045 amended 2026-10-27): the card that shows a sub-page in its parent
 * draws the plain page icon, without the arrow of the linked-page icon, which
 * an inline `@` reference keeps. The host says which pages are children
 * through `TitleBandService.children$`; the library computes no tree.
 *
 * What it would have caught: a card asking for the plain icon without the
 * seam (every host without a page tree would lose the arrow), a child's card
 * keeping the arrow, or an icon that does not follow a move made after the
 * card rendered (the signal not read inside the computation).
 */

function stdWith(children$?: (docId: string) => { value: readonly string[] }) {
  const icon = vi.fn(
    (_pageId: string, info: { referenced?: boolean }) =>
      ({ value: html`${info.referenced ? 'linked' : 'plain'}` }) as const
  );
  const band = children$
    ? { sheet$: vi.fn(), set: vi.fn(), children$ }
    : undefined;
  const std = {
    get: (id: unknown) => (id === DocDisplayMetaProvider ? { icon } : null),
    getOptional: (id: unknown) => (id === TitleBandProvider ? band : null),
  } as unknown as BlockStdScope;
  return { std, icon };
}

const referenced = (icon: ReturnType<typeof stdWith>['icon']) =>
  icon.mock.calls.at(-1)?.[1].referenced;

describe('the icon of a page card', () => {
  it('keeps the arrow without a host (mounted with no provider)', () => {
    const { std, icon } = stdWith();
    expect(isChildCard(std, 'parent', 'kid')).toBe(false);
    cardIcon(std, 'parent', { pageId: 'kid' });
    expect(referenced(icon)).toBe(true);
  });

  it('keeps the arrow for a host whose band lists no children', () => {
    const { std } = stdWith();
    const band = { sheet$: vi.fn(), set: vi.fn() };
    const withBand = {
      ...std,
      getOptional: (id: unknown) => (id === TitleBandProvider ? band : null),
    } as unknown as BlockStdScope;
    expect(isChildCard(withBand, 'parent', 'kid')).toBe(false);
  });

  it("drops the arrow on a child's own card, and follows a move", () => {
    const children = signal<readonly string[]>(['kid']);
    const asked: string[] = [];
    const { std, icon } = stdWith(docId => {
      asked.push(docId);
      return children;
    });
    const icon$ = computed(() => cardIcon(std, 'parent', { pageId: 'kid' }));

    void icon$.value;
    expect(asked).toEqual(['parent']);
    expect(referenced(icon)).toBe(false);

    children.value = [];
    void icon$.value;
    expect(referenced(icon)).toBe(true);
  });

  it('keeps the arrow on a card of a page that is not a child', () => {
    const { std, icon } = stdWith(() => signal(['other']));
    cardIcon(std, 'parent', { pageId: 'kid' });
    expect(referenced(icon)).toBe(true);
  });
});
