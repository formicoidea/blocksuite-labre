/**
 * The canvas cursor of the tools that arm a click: the crosshair is the only
 * sign that the next click lands on the canvas rather than selecting.
 */
import type { ToolOptionWithType } from '@labre/std/gfx';
import { describe, expect, test } from 'vitest';

import { getCursorMode } from '../edgeless/utils/query.js';

const armed = (toolName: string) =>
  ({ toolType: { toolName } }) as unknown as ToolOptionWithType;

describe('getCursorMode', () => {
  test.each(['shape', 'polygon', 'artefact-placement'])(
    'an armed %s tool shows the crosshair',
    toolName => {
      expect(getCursorMode(armed(toolName))).toBe('crosshair');
    }
  );

  test('the default tool keeps the default cursor', () => {
    expect(getCursorMode(armed('default'))).toBe('default');
  });
});
