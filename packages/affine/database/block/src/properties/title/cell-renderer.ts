import {
  type CellRenderProps,
  createFromBaseCellRenderer,
  createIcon,
  uniMap,
} from '@labre/affine-database-engine';
import { TableSingleView } from '@labre/affine-database-engine/view-presets';

import { titlePropertyModelConfig } from './define.js';
import { HeaderAreaTextCell } from './text.js';

export const titleColumnConfig = titlePropertyModelConfig.createPropertyMeta({
  icon: createIcon('TitleIcon'),
  cellRenderer: {
    view: uniMap(
      createFromBaseCellRenderer(HeaderAreaTextCell),
      (props: CellRenderProps) => ({
        ...props,
        showIcon: props.cell.view instanceof TableSingleView,
      })
    ),
  },
});
