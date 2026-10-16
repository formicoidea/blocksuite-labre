/**
 * Two modules contributing the same entry id (the thread "Discuss" action,
 * registered on `affine:*` and `affine:surface:*`) are merged by `group`. The
 * merge once treated the `labelWording` tuple as a list of actions and
 * collapsed it into an object, so the host's `translateKey` threw on every
 * canvas selection and the toolbar failed to render.
 */
import type { ToolbarAction } from '@labre/affine-shared/services';
import { describe, expect, test } from 'vitest';

import { group } from '../utils.js';

describe('group', () => {
  test('keeps a wording tuple intact when two modules share an id', () => {
    const discuss = {
      id: 'g.thread-discuss',
      labelWording: ['com.labre.thread.discuss', 'Discuss'],
    } as unknown as ToolbarAction;

    const [merged] = group([{ ...discuss }, { ...discuss }]);

    expect(merged?.labelWording).toEqual([
      'com.labre.thread.discuss',
      'Discuss',
    ]);
  });

  test('still merges the children of a group by id', () => {
    const a = { id: 'g', actions: [{ id: 'x' }, { id: 'y' }] };
    const b = { id: 'g', actions: [{ id: 'y' }, { id: 'z' }] };

    const [merged] = group([a, b] as unknown as ToolbarAction[]);

    expect(
      (merged as unknown as { actions: { id: string }[] }).actions.map(
        c => c.id
      )
    ).toEqual(['x', 'y', 'z']);
  });
});
