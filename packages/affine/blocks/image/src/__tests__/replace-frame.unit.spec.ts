/**
 * The frame of a replaced element (ADR 0044, amendment of 2026-11-04). Pure.
 *
 * What it would have caught: a picture distorted to a frame of other proportions, a
 * page image that shows more or less than its frame once cropped, or a crop stored
 * for a picture that already fits (the whole image is the absent key, ADR 0037).
 */
import { describe, expect, it } from 'vitest';

import {
  cardStyleFor,
  cropToBox,
  displayedBox,
  pageImageProps,
  storedImageBox,
} from '../replace/frame';

const WIDE = { w: 752, h: 544 };
const SQUARE_PICTURE = { width: 400, height: 400 };

describe('cropToBox', () => {
  it('cuts the largest centred window of the proportions of the box', () => {
    const { crop } = cropToBox({ w: 200, h: 100 }, SQUARE_PICTURE);
    expect(crop).toEqual({ x: 0, y: 0.25, w: 1, h: 0.5 });
  });

  it('writes nothing for a picture that already fits, whatever its size', () => {
    expect(cropToBox({ w: 200, h: 200 }, SQUARE_PICTURE)).toEqual({});
    expect(cropToBox({ w: 2000, h: 2000 }, SQUARE_PICTURE)).toEqual({});
  });

  it('writes nothing for a box without a size', () => {
    expect(cropToBox({ w: 0, h: 100 }, SQUARE_PICTURE)).toEqual({});
  });
});

describe('pageImageProps', () => {
  it('stores the whole picture, so that its crop shows exactly the box', () => {
    const props = pageImageProps(WIDE, SQUARE_PICTURE);
    const crop = props.crop!;
    expect((props.width ?? 0) * crop.w).toBeCloseTo(WIDE.w);
    expect((props.height ?? 0) * crop.h).toBeCloseTo(WIDE.h);
    // Undistorted: the stored size has the picture's own proportions.
    expect((props.width ?? 0) / (props.height ?? 1)).toBeCloseTo(1);
  });

  it('enlarges a small picture by the same way', () => {
    expect(pageImageProps({ w: 800, h: 800 }, { width: 8, height: 8 })).toEqual(
      {
        width: 800,
        height: 800,
      }
    );
  });
});

describe('storedImageBox', () => {
  it('is the crop share of the stored size', () => {
    expect(
      storedImageBox({
        width: 600,
        height: 300,
        crop: { x: 0, y: 0, w: 0.5, h: 1 },
      })
    ).toEqual({ w: 300, h: 300 });
    expect(storedImageBox({ width: 300, height: 150 })).toEqual({
      w: 300,
      h: 150,
    });
  });

  it('is nothing without a stored size', () => {
    expect(storedImageBox({})).toBeNull();
    expect(storedImageBox({ width: 0, height: 0 })).toBeNull();
  });
});

describe('displayedBox', () => {
  const stdShowing = (el: unknown) =>
    ({ view: { getBlock: () => ({ querySelector: () => el }) } }) as never;
  const model = (props: object) => ({ id: 'b', props }) as never;

  it('prefers the stored size to the layout', () => {
    expect(
      displayedBox(
        stdShowing({ offsetWidth: 1, offsetHeight: 1 }),
        model({ width: 300, height: 150 })
      )
    ).toEqual({ w: 300, h: 150 });
  });

  it('reads the layout otherwise, unscaled', () => {
    expect(
      displayedBox(
        stdShowing({ offsetWidth: 700, offsetHeight: 46 }),
        model({ name: 'a.pdf' })
      )
    ).toEqual({ w: 700, h: 46 });
  });

  it('is nothing for a block never laid out', () => {
    expect(displayedBox(stdShowing(null), model({}))).toBeNull();
    expect(
      displayedBox(stdShowing({ offsetWidth: 0, offsetHeight: 0 }), model({}))
    ).toBeNull();
    expect(displayedBox({} as never, model({}))).toBeNull();
  });
});

describe('cardStyleFor', () => {
  it('draws a band in a wide frame and a tile otherwise', () => {
    expect(cardStyleFor({ w: 460, h: 60 })).toBe('horizontalThin');
    expect(cardStyleFor(WIDE)).toBe('cubeThick');
  });
});
