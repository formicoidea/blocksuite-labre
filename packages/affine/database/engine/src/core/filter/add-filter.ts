import {
  menu,
  popMenu,
  type PopupTarget,
} from '@labre/affine-components/context-menu';
import { AddCursorIcon } from '@blocksuite/icons/lit';
import type { Middleware } from '@floating-ui/dom';
import type { ReadonlySignal } from '@preact/signals-core';

import type { Variable } from '../expression/index.js';
import { renderUniLit } from '../utils/index.js';
import type { Filter } from './types.js';
import { firstFilterByRef, firstFilterInGroup } from './utils.js';
import {
  DATA_VIEW_FILTER_NEW,
  DATA_VIEW_FILTER_ADD_GROUP,
} from '../../translations.js';
import { wordingFrom } from '../utils/wording.js';

export const popCreateFilter = (
  target: PopupTarget,
  props: {
    vars: ReadonlySignal<Variable[]>;
    onSelect: (filter: Filter) => void;
    onClose?: () => void;
    onBack?: () => void;
  },
  ops?: {
    middleware?: Middleware[];
  }
) => {
  popMenu(target, {
    middleware: ops?.middleware,
    options: {
      onClose: props.onClose,
      title: {
        onBack: props.onBack,
        text: wordingFrom(target.element)(DATA_VIEW_FILTER_NEW),
      },
      items: [
        menu.group({
          items: props.vars.value.map(v =>
            menu.action({
              name: v.name,
              prefix: renderUniLit(v.icon, {}),
              select: () => {
                props.onSelect(
                  firstFilterByRef(props.vars.value, {
                    type: 'ref',
                    name: v.id,
                  })
                );
              },
            })
          ),
        }),
        menu.group({
          name: '',
          items: [
            menu.action({
              name: wordingFrom(target.element)(DATA_VIEW_FILTER_ADD_GROUP),
              prefix: AddCursorIcon(),
              select: () => {
                props.onSelect(firstFilterInGroup(props.vars.value));
              },
            }),
          ],
        }),
      ],
    },
  });
};
