/**
 * GUARD — the notice a view draws in place of its body when the host says
 * its source cannot be read now (`sourceUnavailableNotice`, ADR 0035
 * amendments of 2026-10-30 and 2026-11-20).
 *
 * Issue #693 (the Labre host's ADR-0073): a guest may read a base and a view
 * whose source is not open to the guest's page; the host had no reason for
 * that state and sent `'unshared'`, which drew "Database not shared" over a
 * base that IS shared. This spec would have caught:
 * - `'not-open'` drawn as anything but its own title and hint, with its own
 *   test id, or with a button (the gesture that opens a source is the
 *   host's);
 * - a translation provider not honoured for either of its two keys;
 * - a reason this build does not know (`'unknown'`) drawing an error or
 *   nothing instead of the neutral "Source not found";
 * - the three earlier reasons changed on the way (wording, test id, the
 *   spinner's `aria-busy`), or any of them losing `role="status"`.
 *
 * The block around it (title and view bar kept, no row, no "New", no
 * "Connect a source", nothing written from before the first render,
 * switching views, a live flip with a stale cell selection) is held in a
 * real editor by `integration-test/…/page/database-cross-database-view.spec.ts`.
 */
import { TranslationProvider } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { render } from 'lit';
import { afterEach, describe, expect, test } from 'vitest';

import type { HostedSourceUnavailableState } from '../external-data-source.js';
import { sourceUnavailableNotice } from '../source-unavailable.js';

const noHost = { getOptional: () => null } as unknown as BlockStdScope;

function withCatalogue(catalogue: Record<string, string>): BlockStdScope {
  const translation = { t: (key: string) => catalogue[key], language: 'fr' };
  return {
    getOptional: (id: unknown) =>
      id === TranslationProvider ? translation : null,
  } as unknown as BlockStdScope;
}

function draw(state: HostedSourceUnavailableState, std = noHost) {
  const container = document.createElement('div');
  document.body.append(container);
  render(sourceUnavailableNotice(std, state), container);
  return container.firstElementChild as HTMLElement;
}

const textsOf = (notice: HTMLElement) =>
  [...notice.children].map(child => child.textContent?.trim());

afterEach(() => {
  document.body.innerHTML = '';
});

describe('a source not open to the reader’s page', () => {
  test('draws "Source not open" and its hint, a status with no button', () => {
    const notice = draw('not-open');
    expect(notice.dataset.testid).toBe('database-source-not-open');
    expect(notice.getAttribute('role')).toBe('status');
    expect(textsOf(notice)).toEqual([
      'Source not open',
      'This view reads a source that is not open to this page. Open the source to this page to see its rows.',
    ]);
    expect(notice.querySelector('button, data-view-component-button')).toBe(
      null
    );
  });

  test("honours the host's catalogue for both keys", () => {
    const notice = draw(
      'not-open',
      withCatalogue({
        'com.labre.database.source-not-open': 'Source non ouverte',
        'com.labre.database.source-not-open.hint': 'Ouvrez-la ici.',
      })
    );
    expect(textsOf(notice)).toEqual(['Source non ouverte', 'Ouvrez-la ici.']);
  });
});

describe('a reason this build does not know', () => {
  test('draws the neutral "Source not found", a status, never an error', () => {
    const notice = draw('unknown');
    expect(notice.dataset.testid).toBe('database-source-unknown');
    expect(notice.getAttribute('role')).toBe('status');
    expect(textsOf(notice)).toEqual([
      'Source not found',
      'The source this view reads was deleted or cannot be reached. Pick another view.',
    ]);
  });
});

describe('the earlier reasons are unchanged', () => {
  test.each([
    [
      'unshared',
      'Database not shared',
      'This view reads a source of a database that is not shared with you.',
    ],
    [
      'trashed',
      'Source in the trash',
      'This view reads a source that is in the trash. Restore it to see its rows.',
    ],
  ] as const)('%s', (state, title, hint) => {
    const notice = draw(state);
    expect(notice.dataset.testid).toBe(`database-source-${state}`);
    expect(notice.getAttribute('role')).toBe('status');
    expect(textsOf(notice)).toEqual([title, hint]);
  });

  test('loading draws a busy spinner and no words', () => {
    const notice = draw('loading');
    expect(notice.dataset.testid).toBe('database-source-loading');
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.getAttribute('aria-busy')).toBe('true');
    expect(notice.textContent?.trim()).toBe('');
    expect(notice.querySelector('svg')).not.toBe(null);
  });
});
