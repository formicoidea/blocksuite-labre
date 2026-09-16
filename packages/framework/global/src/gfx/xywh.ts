/**
 * XYWH represents the x, y, width, and height of an element or block.
 */
export type XYWH = [number, number, number, number];

/**
 * SerializedXYWH is a string that represents the x, y, width, and height of a block.
 */
export type SerializedXYWH = `[${number},${number},${number},${number}]`;

export function serializeXYWH(
  x: number,
  y: number,
  w: number,
  h: number
): SerializedXYWH {
  return `[${x},${y},${w},${h}]`;
}

export function deserializeXYWH(xywh: string): XYWH {
  // An ABSENT value is not a parse failure: a document whose Yjs state has
  // pending structs can hand us an element whose `xywh` key is simply missing.
  // Say nothing here — this getter runs several times per frame per element,
  // and the surface already reports the damaged element once, at mount.
  if (xywh === null || xywh === undefined) {
    return [0, 0, 0, 0];
  }

  try {
    return JSON.parse(xywh) as XYWH;
  } catch (e) {
    console.error('Failed to deserialize xywh', xywh);
    console.error(e);

    return [0, 0, 0, 0];
  }
}
