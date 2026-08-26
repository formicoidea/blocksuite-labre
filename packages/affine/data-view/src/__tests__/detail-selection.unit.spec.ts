import { signal } from '@preact/signals-core';
import { describe, expect, it, vi } from 'vitest';

import { DetailSelection } from '../core/detail/selection.js';
import type { DataViewCellLifeCycle } from '../core/property/index.js';

describe('DetailSelection', () => {
  it('avoids a recursive selection update when leaving edit mode', () => {
    vi.stubGlobal('requestAnimationFrame', ((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof requestAnimationFrame);
    try {
      let selection: DetailSelection;
      let beforeExitCalls = 0;

      // A cell whose exit hook writes its value back, which in turn re-asks for
      // the very selection that is being applied.
      const cell = {
        beforeEnterEditMode: () => true,
        beforeExitEditingMode: () => {
          beforeExitCalls += 1;
          selection.selection = {
            propertyId: 'status',
            isEditing: false,
          };
        },
        afterEnterEditingMode: () => {},
        focusCell: () => true,
        blurCell: () => true,
        forceUpdate: () => {},
      } satisfies DataViewCellLifeCycle;

      const field = {
        isFocus$: signal(false),
        isEditing$: signal(false),
        cell,
        focus: () => {},
        blur: () => {},
      };

      const detail = {
        querySelector: () => field,
      };

      selection = new DetailSelection(detail);
      selection.selection = {
        propertyId: 'status',
        isEditing: true,
      };

      selection.selection = {
        propertyId: 'status',
        isEditing: false,
      };

      expect(beforeExitCalls).toBe(1);
      expect(field.isEditing$.value).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('ignores a selection identical to the current one', () => {
    let focusCalls = 0;
    let blurCalls = 0;

    const field = {
      isFocus$: signal(false),
      isEditing$: signal(false),
      cell: undefined,
      focus: () => {
        focusCalls += 1;
      },
      blur: () => {
        blurCalls += 1;
      },
    };

    const selection = new DetailSelection({ querySelector: () => field });
    selection.selection = { propertyId: 'status', isEditing: false };
    expect(focusCalls).toBe(1);

    selection.selection = { propertyId: 'status', isEditing: false };
    expect(focusCalls).toBe(1);
    expect(blurCalls).toBe(0);
  });
});
