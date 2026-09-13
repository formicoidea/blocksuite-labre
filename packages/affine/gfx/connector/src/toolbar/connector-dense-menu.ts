import { menu } from '@labre/affine-components/context-menu';
import { ConnectorMode } from '@labre/affine-model';
import { EditPropsStore, translateKey } from '@labre/affine-shared/services';
import type { DenseMenuBuilder } from '@labre/affine-widget-edgeless-toolbar';
import {
  ConnectorCIcon,
  ConnectorEIcon,
  ConnectorLIcon,
} from '@blocksuite/icons/lit';

import { ConnectorTool } from '../connector-tool';
import {
  CONNECTOR_LABEL_CONNECTOR,
  CONNECTOR_MODE_WORDING,
} from '../translations';

export const buildConnectorDenseMenu: DenseMenuBuilder = (edgeless, gfx) => {
  const prevMode =
    edgeless.std.get(EditPropsStore).lastProps$.value.connector.mode;

  const isSelected = gfx.tool.currentToolName$.peek() === 'connector';

  const createSelect =
    (mode: ConnectorMode, record = true) =>
    () => {
      gfx.tool.setTool(ConnectorTool, {
        mode,
      });
      record &&
        edgeless.std.get(EditPropsStore).recordLastProps('connector', { mode });
    };

  const iconSize = { width: '20', height: '20' };
  const std = edgeless.std;
  return menu.subMenu({
    name: translateKey(std, ...CONNECTOR_LABEL_CONNECTOR),
    prefix: ConnectorCIcon(iconSize),
    select: createSelect(prevMode, false),
    isSelected,
    options: {
      items: [
        menu.action({
          name: translateKey(
            std,
            ...CONNECTOR_MODE_WORDING[ConnectorMode.Curve]
          ),
          prefix: ConnectorCIcon(iconSize),
          select: createSelect(ConnectorMode.Curve),
          isSelected: isSelected && prevMode === ConnectorMode.Curve,
        }),
        menu.action({
          name: translateKey(
            std,
            ...CONNECTOR_MODE_WORDING[ConnectorMode.Orthogonal]
          ),
          prefix: ConnectorEIcon(iconSize),
          select: createSelect(ConnectorMode.Orthogonal),
          isSelected: isSelected && prevMode === ConnectorMode.Orthogonal,
        }),
        menu.action({
          name: translateKey(
            std,
            ...CONNECTOR_MODE_WORDING[ConnectorMode.Straight]
          ),
          prefix: ConnectorLIcon(iconSize),
          select: createSelect(ConnectorMode.Straight),
          isSelected: isSelected && prevMode === ConnectorMode.Straight,
        }),
      ],
    },
  });
};
