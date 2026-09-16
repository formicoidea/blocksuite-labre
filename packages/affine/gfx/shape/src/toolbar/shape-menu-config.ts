import type { ShapeToolOption } from '@labre/affine-gfx-shape';
import { ShapeType } from '@labre/affine-model';
import type { ChromeWording } from '@labre/affine-shared/services';
import {
  DiamondIcon,
  EllipseIcon,
  RoundedRectangleIcon,
  SquareIcon,
  TriangleIcon,
} from '@blocksuite/icons/lit';
import type { TemplateResult } from 'lit';

import {
  GeneralPolygonIcon,
  ScribbledDiamondIcon,
  ScribbledEllipseIcon,
  ScribbledPolygonIcon,
  ScribbledRoundedRectangleIcon,
  ScribbledSquareIcon,
  ScribbledTriangleIcon,
} from './icons';
import {
  SHAPE_NAME_DIAMOND,
  SHAPE_NAME_ELLIPSE,
  SHAPE_NAME_POLYGON,
  SHAPE_NAME_ROUNDED_RECT,
  SHAPE_NAME_SQUARE,
  SHAPE_NAME_TRIANGLE,
} from '../translations';

type Config = {
  name: ShapeToolOption['shapeName'];
  generalIcon: TemplateResult<1>;
  scribbledIcon: TemplateResult<1>;
  tooltip: string;
  /** {@link tooltip}, for the translation seam. */
  tooltipWording: ChromeWording;
  disabled: boolean;
};

export const ShapeComponentConfig: Config[] = [
  {
    name: ShapeType.Rect,
    generalIcon: SquareIcon(),
    scribbledIcon: ScribbledSquareIcon,
    tooltip: 'Square',
    tooltipWording: SHAPE_NAME_SQUARE,
    disabled: false,
  },
  {
    name: ShapeType.Ellipse,
    generalIcon: EllipseIcon(),
    scribbledIcon: ScribbledEllipseIcon,
    tooltip: 'Ellipse',
    tooltipWording: SHAPE_NAME_ELLIPSE,
    disabled: false,
  },
  {
    name: ShapeType.Diamond,
    generalIcon: DiamondIcon(),
    scribbledIcon: ScribbledDiamondIcon,
    tooltip: 'Diamond',
    tooltipWording: SHAPE_NAME_DIAMOND,
    disabled: false,
  },
  {
    name: ShapeType.Triangle,
    generalIcon: TriangleIcon(),
    scribbledIcon: ScribbledTriangleIcon,
    tooltip: 'Triangle',
    tooltipWording: SHAPE_NAME_TRIANGLE,
    disabled: false,
  },
  {
    name: ShapeType.Polygon,
    generalIcon: GeneralPolygonIcon,
    scribbledIcon: ScribbledPolygonIcon,
    tooltip: 'Polygon',
    tooltipWording: SHAPE_NAME_POLYGON,
    disabled: false,
  },
  {
    name: 'roundedRect',
    generalIcon: RoundedRectangleIcon(),
    scribbledIcon: ScribbledRoundedRectangleIcon,
    tooltip: 'Rounded rectangle',
    tooltipWording: SHAPE_NAME_ROUNDED_RECT,
    disabled: false,
  },
];

export const ShapeComponentConfigMap = ShapeComponentConfig.reduce(
  (acc, config) => {
    acc[config.name] = config;
    return acc;
  },
  {} as Record<Config['name'], Config>
);
