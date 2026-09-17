import { isNativeFocusableTarget } from '@labre/affine-shared/utils';
import { KeymapExtension } from '@labre/std';

export const fallbackKeymap = KeymapExtension(() => {
  return {
    Tab: ctx => {
      const event = ctx.get('defaultState').event;
      if (isNativeFocusableTarget(event.target)) return;
      event.stopPropagation();
      event.preventDefault();
    },
    'Shift-Tab': ctx => {
      const event = ctx.get('defaultState').event;
      if (isNativeFocusableTarget(event.target)) return;
      event.stopPropagation();
      event.preventDefault();
    },
  };
});
