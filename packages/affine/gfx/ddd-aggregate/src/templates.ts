import {
  makeTemplateSnapshot,
  type SurfaceElementsJSON,
  surfaceText,
  type Template,
  type TemplateCategory,
} from '@labre/affine-gfx-template';
import { FontFamily, ShapeStyle, TextAlign } from '@labre/affine-model';

const DARK = '#323d4f';
const WHITE = '#ffffff';

function box(x: number, y: number, w: number, h: number) {
  return {
    type: 'shape',
    shapeType: 'rect',
    filled: true,
    fillColor: WHITE,
    strokeColor: DARK,
    strokeWidth: 1,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    radius: 0,
    xywh: `[${x},${y},${w},${h}]`,
  };
}

function title(x: number, y: number, str: string, color = DARK, fontSize = 20) {
  return {
    type: 'text',
    text: surfaceText(str),
    color,
    fontFamily: FontFamily.Inter,
    fontSize,
    textAlign: TextAlign.Left,
    xywh: `[${x},${y},340,28]`,
  };
}

/** The Aggregate Design Canvas v1.1 (Kacper Gunia / DDD Crew): nine sections. */
function aggregateCanvas(): SurfaceElementsJSON {
  return {
    bg: {
      type: 'shape',
      shapeType: 'rect',
      filled: true,
      fillColor: DARK,
      strokeColor: '#00000000',
      strokeWidth: 0,
      shapeStyle: ShapeStyle.General,
      roughness: 0,
      radius: 0,
      xywh: '[0,0,1060,770]',
    },
    headerBar: {
      type: 'shape',
      shapeType: 'rect',
      filled: true,
      fillColor: DARK,
      strokeColor: '#00000000',
      strokeWidth: 0,
      shapeStyle: ShapeStyle.General,
      roughness: 0,
      radius: 0,
      xywh: '[9,10,1040,40]',
    },
    headerTitle: title(16, 18, 'Aggregate Design Canvas', WHITE, 30),

    nameBox: box(9, 60, 350, 50),
    nameTitle: title(18, 72, '1. Name'),
    descBox: box(9, 120, 350, 170),
    descTitle: title(18, 132, '2. Description'),
    stateBox: box(369, 60, 680, 230),
    stateTitle: title(378, 72, '3. State Transitions'),
    invariantsBox: box(9, 300, 350, 210),
    invariantsTitle: title(18, 312, '4. Enforced Invariants'),
    policiesBox: box(9, 520, 350, 200),
    policiesTitle: title(18, 532, '5. Corrective Policies'),
    commandsBox: box(369, 300, 350, 210),
    commandsTitle: title(378, 312, '6. Handled Commands'),
    eventsBox: box(369, 520, 350, 200),
    eventsTitle: title(378, 532, '7. Created Events'),
    throughputBox: box(729, 300, 320, 210),
    throughputTitle: title(738, 312, '8. Throughput'),
    sizeBox: box(729, 520, 320, 200),
    sizeTitle: title(738, 532, '9. Size'),
  };
}

const PREVIEW = `<svg width="100%" height="100%" viewBox="0 0 135 80" xmlns="http://www.w3.org/2000/svg"><rect width="135" height="80" fill="#323d4f"/><rect x="3" y="3" width="129" height="6" fill="#323d4f"/><g fill="#fff"><rect x="3" y="11" width="42" height="6"/><rect x="3" y="19" width="42" height="22"/><rect x="47" y="11" width="85" height="28"/><rect x="3" y="43" width="42" height="16"/><rect x="3" y="61" width="42" height="16"/><rect x="47" y="43" width="42" height="16"/><rect x="47" y="61" width="42" height="16"/><rect x="91" y="43" width="41" height="16"/><rect x="91" y="61" width="41" height="16"/></g></svg>`;

/**
 * Standalone Aggregate Design Canvas section (gated by `ddd-templates`). Unlike
 * the per-senior-button categories (which live in the shared package), this one
 * has no senior button — it ships only as a Templates-panel prefab.
 */
export const aggregateTemplateCategory: TemplateCategory = {
  name: 'Aggregate Design Canvas',
  templates: [
    {
      name: 'Aggregate Design Canvas',
      type: 'template',
      preview: PREVIEW,
      content: makeTemplateSnapshot(
        aggregateCanvas(),
        'Aggregate Design Canvas'
      ),
    } satisfies Template,
  ],
};
