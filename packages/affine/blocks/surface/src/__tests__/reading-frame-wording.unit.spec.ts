import type { RoleDefs } from '@labre/std/gfx';
import { describe, expect, expectTypeOf, it } from 'vitest';

import type { FrameworkBackgroundDef } from '../framework-background/def.js';
import {
  READING_FRAME_DEFAULT_WORDING,
  READING_FRAME_WORDINGS,
  readingFrameWording,
  type ReadingProfile,
} from '../extensions/reading.js';

/**
 * A reading profile written against 0.43 keeps compiling, and keeps its panel.
 *
 * 0.44.0 (#428) made `ReadingProfile.frame.label` and `frame.none` REQUIRED so
 * the panel stopped hard-coding Wardley's "Evolution phase". Every host that
 * declared its own profile with a frame — `{ backgroundRole, background, axis }`,
 * the whole of the 0.43 shape — stopped compiling on a minor bump, which the
 * release rule forbids (`0.x` minors never break a host). This spec would have
 * caught it: the fixture below is a literal 0.43 profile, typed by the CURRENT
 * `ReadingProfile`, so `yarn build` (which typechecks tests) fails the day a
 * field a 0.43 host never wrote becomes required again.
 *
 * The runtime half pins what such a profile shows: exactly what 0.43 showed,
 * through the same two keys and the same English, declared once by the engine
 * so they exist whether or not the Wardley bundle is installed.
 */

const ROLES: RoleDefs = {
  'host:item': { id: 'host:item', kind: 'node' },
  'host:board': { id: 'host:board', kind: 'node' },
};

const BACKGROUND: FrameworkBackgroundDef = {
  type: 'host',
  role: 'host:board',
  geometry: {
    width: 1000,
    height: 500,
    lockAspectRatio: true,
    resizable: false,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  },
  zones: [{ id: 'only', rect: { x: 0, y: 0, w: 1, h: 1 } }],
};

/** Written exactly as a 0.43 host wrote it: a frame, and no wording. */
const PROFILE_043 = {
  id: 'host-reading',
  framework: 'wardley',
  roles: ROLES,
  appliesTo: 'host:item',
  frame: {
    backgroundRole: 'host:board',
    background: BACKGROUND,
    axis: 'x',
  },
} satisfies ReadingProfile;

describe('a 0.43-shaped reading profile', () => {
  it('is still a ReadingProfile', () => {
    expectTypeOf(PROFILE_043).toMatchTypeOf<ReadingProfile>();
    const profile: ReadingProfile = PROFILE_043;
    expect(profile.frame?.label).toBeUndefined();
  });

  it('reads its frame with the wording 0.43 showed', () => {
    expect(readingFrameWording(PROFILE_043.frame)).toEqual({
      label: {
        labelKey: 'com.labre.reading.field.phase',
        labelFallback: 'Evolution phase',
      },
      none: {
        labelKey: 'com.labre.reading.phase.none',
        labelFallback: 'Not on a framework background — no phase to read.',
      },
    });
  });

  it('keeps a framework’s own wording when it declares one', () => {
    const label = { labelKey: 'k.lane', labelFallback: 'Lane' };
    const none = { labelKey: 'k.lane.none', labelFallback: 'In no lane.' };
    expect(readingFrameWording({ ...PROFILE_043.frame, label, none })).toEqual({
      label,
      none,
    });
  });

  it('declares the default wording once, for the manifest to walk', () => {
    expect(READING_FRAME_WORDINGS).toEqual([
      [
        READING_FRAME_DEFAULT_WORDING.label.labelKey,
        READING_FRAME_DEFAULT_WORDING.label.labelFallback,
      ],
      [
        READING_FRAME_DEFAULT_WORDING.none.labelKey,
        READING_FRAME_DEFAULT_WORDING.none.labelFallback,
      ],
    ]);
  });
});
