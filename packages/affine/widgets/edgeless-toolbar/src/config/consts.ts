import { STYLE_GENERAL, STYLE_SCRIBBLED } from '@labre/affine-shared/services';
import { StyleGeneralIcon, StyleScribbleIcon } from '@blocksuite/icons/lit';

import type { MenuItem } from './types';

export const LINE_STYLE_LIST = [
  {
    key: 'General',
    keyWording: STYLE_GENERAL,
    value: false,
    icon: StyleGeneralIcon(),
  },
  {
    key: 'Scribbled',
    keyWording: STYLE_SCRIBBLED,
    value: true,
    icon: StyleScribbleIcon(),
  },
] as const satisfies MenuItem<boolean>[];
