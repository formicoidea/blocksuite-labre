/**
 * A `Path2D` that carries the `d` it was built from.
 *
 * The SVG export replays the element renderers into an SVG-emitting context,
 * and a native `Path2D` is a black box: nothing can read its geometry back, so
 * a shape drawn through one would be missing from the export. The tag is what
 * the export reads — see `svg-context.ts`.
 *
 * Use it anywhere a renderer builds a `Path2D` FROM A STRING. A path built by
 * calling methods (`new Path2D()` then `rect(...)`) needs no tag: the export
 * records those calls itself.
 *
 * It is a plain function, not a constant: `Path2D` does not exist under Node,
 * so this must only ever run on a paint, never at module load.
 */
export function taggedPath2D(d: string): Path2D {
  const path = new Path2D(d);
  // While the export's recording `Path2D` is installed, the instance already
  // exposes `d` through a getter; writing it again would throw.
  if (typeof (path as { d?: unknown }).d !== 'string') {
    Object.defineProperty(path, 'd', { value: d, enumerable: true });
  }
  return path;
}
