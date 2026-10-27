import type {
  FrameworkToolbox,
  SerializedElementProps,
  ToolboxItem,
  ToolboxPoint,
} from '@labre/affine-block-surface/interchange';
import { Bound } from '@labre/global/gfx';

import { cynefinEstuarineCommandsManifest } from './commands-manifest';
import { HEX_SIZE } from './estuarine/consts';
import {
  CYNEFIN_H,
  CYNEFIN_W,
  cynefinBackgroundProps,
  ESTUARINE_MAP_H,
  ESTUARINE_MAP_W,
  estuarineHexagonProps,
  estuarineMapProps,
} from './presets';

/**
 * The Cynefin and estuarine toolbar as pure builders (`docs/adr/0045`): what
 * `createCynefin`, `createEstuarineMap` and `createConstraintHexagon` place,
 * with no editor behind them. The actions call these, so an element built
 * here and one placed from the toolbar are the same element. The framework
 * has no relation style: there is no link.
 */

/** The Cynefin framework background at `at`, its top-left. */
export function cynefinElement(
  at: ToolboxPoint,
  local = 'cynefin'
): SerializedElementProps {
  return {
    ...cynefinBackgroundProps({
      xywh: new Bound(at.x, at.y, CYNEFIN_W, CYNEFIN_H).serialize(),
    }),
    id: local,
  };
}

/** The estuarine map background at `at`, its top-left. */
export function estuarineMapElement(
  at: ToolboxPoint,
  local = 'estuarine-map'
): SerializedElementProps {
  return {
    ...estuarineMapProps({
      xywh: new Bound(at.x, at.y, ESTUARINE_MAP_W, ESTUARINE_MAP_H).serialize(),
    }),
    id: local,
  };
}

/**
 * A constraint hexagon at `at`, its top-left. The toolbar places it empty; a
 * `name` is written as the shape's own inner text, where a user types it.
 */
export function constraintHexagonElement(
  at: ToolboxPoint,
  name?: string,
  local = 'constraint-hexagon'
): SerializedElementProps {
  const text = name?.trim();
  return {
    ...estuarineHexagonProps({
      xywh: new Bound(at.x, at.y, HEX_SIZE, HEX_SIZE).serialize(),
    }),
    ...(text ? { text } : {}),
    id: local,
  };
}

/** The toolbar command's label, so a host names an item as the toolbar does. */
function label(commandId: string) {
  const row = cynefinEstuarineCommandsManifest.find(r => r.id === commandId);
  return {
    labelKey: row?.labelKey ?? commandId,
    labelFallback: row?.labelFallback ?? commandId,
  };
}

const items: ToolboxItem[] = [
  {
    id: 'cynefin',
    ...label('cynefin-estuarine.addCynefin'),
    texts: [],
    size: { w: CYNEFIN_W, h: CYNEFIN_H },
    build: (at, _texts, local) => [cynefinElement(at, local)],
  },
  {
    id: 'estuarine-map',
    ...label('cynefin-estuarine.addEstuarineMap'),
    texts: [],
    size: { w: ESTUARINE_MAP_W, h: ESTUARINE_MAP_H },
    build: (at, _texts, local) => [estuarineMapElement(at, local)],
  },
  {
    id: 'constraint-hexagon',
    ...label('cynefin-estuarine.addConstraintHexagon'),
    texts: ['name'],
    size: { w: HEX_SIZE, h: HEX_SIZE },
    build: (at, texts, local) => [
      constraintHexagonElement(at, texts?.name, local),
    ],
  },
];

/** Every item of the Cynefin and estuarine toolbar, in the toolbar's order. */
export const CYNEFIN_ESTUARINE_TOOLBOX: FrameworkToolbox = {
  framework: 'cynefin-estuarine',
  items,
  links: [],
};
