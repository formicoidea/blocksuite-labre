import { describe, expect, it, vi } from 'vitest';

const { recordedInputConfigs } = vi.hoisted(() => ({
  recordedInputConfigs: [] as Record<string, unknown>[],
}));

vi.mock('@labre/affine-components/context-menu', () => ({
  menu: {
    input: (config: Record<string, unknown>) => {
      recordedInputConfigs.push(config);
      return () => undefined;
    },
  },
}));

import type { Property } from '../core/view-manager/property.js';

import { inputConfig } from '../core/common/property-menu.js';

const createProperty = (nameSet: (name: string) => void) =>
  ({
    name$: { value: 'Old name' },
    icon: undefined,
    nameSet,
  }) as unknown as Property;

describe('property menu input', () => {
  it('persists the typed name when the input loses focus', () => {
    const nameSet = vi.fn();
    inputConfig(createProperty(nameSet));

    const config = recordedInputConfigs.at(-1);
    expect(config).toBeDefined();
    expect(typeof config?.onBlur).toBe('function');

    (config?.onBlur as (value: string) => void)('New name');
    expect(nameSet).toHaveBeenCalledWith('New name');
  });

  it('uses the same wiring on mobile and desktop', () => {
    const nameSet = vi.fn();
    inputConfig(createProperty(nameSet));

    const config = recordedInputConfigs.at(-1);
    // A single code path: no `onComplete`-only variant that would drop the
    // value when the menu is dismissed by a click outside.
    expect(config?.onComplete).toBeUndefined();
    expect(config?.initialValue).toBe('Old name');
  });
});
