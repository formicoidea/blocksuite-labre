import { describe, expect, it } from 'vitest';

import { cynefinEstuarineCommandsManifest } from '../commands-manifest';
import { HEX_SIZE } from '../estuarine/consts';
import { ESTUARINE_ROLE } from '../estuarine/roles';
import {
  CYNEFIN_H,
  CYNEFIN_W,
  cynefinBackgroundProps,
  ESTUARINE_MAP_H,
  ESTUARINE_MAP_W,
  estuarineHexagonBox,
  estuarineHexagonProps,
  estuarineMapProps,
} from '../presets';
import {
  constraintHexagonElement,
  CYNEFIN_ESTUARINE_TOOLBOX,
  cynefinElement,
  estuarineMapElement,
} from '../toolbox';

/**
 * The Cynefin and estuarine toolbar as pure builders (`docs/adr/0045`). What
 * it would have caught: an element built for a host that differs from the
 * toolbar's (a background at another size, a map or a hexagon without its
 * role or the preset's props, a hexagon box off the one the toolbar centres),
 * and a toolbar item a host cannot name the way the toolbar does.
 */
describe('cynefin-estuarine toolbox', () => {
  it('builds both backgrounds from the presets, at their toolbar size', () => {
    expect(cynefinElement({ x: 10, y: 20 })).toEqual({
      ...cynefinBackgroundProps({
        xywh: `[10,20,${CYNEFIN_W},${CYNEFIN_H}]`,
      }),
      id: 'cynefin',
    });
    expect(CYNEFIN_W).toBe(1080);
    expect(CYNEFIN_H).toBe(777);
    expect(estuarineMapElement({ x: 0, y: 0 }, 'm')).toEqual({
      ...estuarineMapProps({
        xywh: `[0,0,${ESTUARINE_MAP_W},${ESTUARINE_MAP_H}]`,
      }),
      id: 'm',
    });
    expect(estuarineMapElement({ x: 0, y: 0 })).toMatchObject({
      type: 'estuarine',
      role: ESTUARINE_ROLE.map,
    });
  });

  it('builds the hexagon as the toolbar does, its name inside when given', () => {
    const at = { x: 100 - HEX_SIZE / 2, y: 50 - HEX_SIZE / 2 };
    const empty = constraintHexagonElement(at);
    // The same box `estuarineHexagonBox` centres on (100, 50).
    expect(empty).toEqual({
      ...estuarineHexagonProps({ xywh: estuarineHexagonBox(100, 50) }),
      id: 'constraint-hexagon',
    });
    expect(empty).not.toHaveProperty('text');
    expect(constraintHexagonElement(at, ' Budget ', 'h')).toMatchObject({
      type: 'shape',
      shapeType: 'polygon',
      role: ESTUARINE_ROLE.constraint,
      text: 'Budget',
      id: 'h',
    });
  });

  it('lists every toolbar artefact, named by its toolbar command', () => {
    // The toolbar's own order (`cynefinEstuarineCommandsManifest`).
    expect(CYNEFIN_ESTUARINE_TOOLBOX.items.map(i => i.id)).toEqual([
      'cynefin',
      'estuarine-map',
      'constraint-hexagon',
    ]);
    expect(CYNEFIN_ESTUARINE_TOOLBOX.links).toEqual([]);
    const labels = new Set(
      cynefinEstuarineCommandsManifest.map(r => r.labelKey)
    );
    for (const item of CYNEFIN_ESTUARINE_TOOLBOX.items) {
      expect(labels.has(item.labelKey), item.id).toBe(true);
      expect(item.build({ x: 0, y: 0 })).toHaveLength(1);
    }
  });
});
